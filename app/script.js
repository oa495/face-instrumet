/* global clm, Tone, requestAnimFrame */
var ctrack, trackingStarted, bass, snare, kick, synth;
document.addEventListener("DOMContentLoaded", function() {
    var CUR_CHORD;
    /** Code for face tracking **/
    ctrack = new clm.tracker();
    ctrack.init();
    trackingStarted = false;
    var k = 5;
    var bucketSize = vidWidth / k;

    function normalizeFace(positions) {
      positions = positions.slice();

      var size = getSize(positions);

      for (var i = 0; i < positions.length; i++) {
        var p = [(positions[i][0] - size.minX) / size.deltaX,
                 (positions[i][1] - size.minY) / size.deltaY];

        positions[i] = p;

      }
      return positionsToFace(positions);
    }

    function positionsToFace(positions) {
        var face = { };

        face.upperMouth = positions.slice(59, 62) // slice is not inclusive
        face.lowerMouth = positions.slice(56, 59) // slice is not inclusive
        face.pupilLeft = [positions[27]];
        face.pupilRight = [positions[32]];

        face.eyebrowLeft = positions.slice(19, 23);
        face.eyebrowRight = positions.slice(15, 19);

        face.nose = positions.slice(34, 41);
        face.bridge = [positions[33], positions[41], positions[62]];
        face.upperLip = positions.slice(44, 51);
        face.lowerLip = positions.slice(50, 58);

        // the eye has the upper, the lower and the middle portions
        // Q: can each part can correspond to an instrument piece?
        face.eyeLeft = [];
        face.eyeRight = [];

        face.positions = positions;
        return face;
    }

    function getVariance(points, avg) {
      // do we make variance a single number or two numbers?
      var xSse = 0;
      var ySse = 0;
      for (var p in points) {
          xSse += Math.pow(points[p][0] - avg[0], 2)
          ySse += Math.pow(points[p][1] - avg[1], 2)

      }

      xSse /= points.length;
      ySse /= points.length;

      return [xSse, ySse];

    }

    function getAverage(points) {
      if (points.length == 1) {
        return points[0];
      }

      var x = 0;
      var y = 0;

      for (var n in points) {
        x += points[n][0];
        y += points[n][1];
      }

      x /= points.length;
      y /= points.length;

      return [x,y];

    }

    var prevFace = {};
    function calcDeltas(face, center) {
      var faceDelta = {};

      if (prevFace) {
        for (var field in face) {
            if (!prevFace[field]) {
                continue;
            }
            // each part of face is actually an array.
            // maybe we should take the center of mass for each face
            // position

            var f = getAverage(face[field]);


            faceDelta[field] = [center[0] - f[0], center[1] - f[1]];

        }

      }
      prevFace = face;

      return faceDelta;

    }

    function setThreshold() {
      for (var part in face) {
        face[part].setThreshold();
      }
    }

    function SliderInstrument(part) {
      this.slider = true;
      this.deltaX = 0;
      this.deltaY = 0;

      this.setContainer = function(div) {
        this.$el = document.createElement("div");
        div.append(this.$el);
      };

      this.render = function() {
        this.$el.textContent = parseInt(this.deltaX*100) + ":" + parseInt(this.deltaY*100);
      };

      this.update = function(facePositions) {
        let { centerX, centerY } = getCenterOfElement(vid);
        var avg = getAverage(facePositions[part]);
        this.deltaX = Math.floor(centerX - avg[0]);
        this.deltaY = Math.floor(centerY - avg[1]);

        var bucket = Math.floor(this.deltaX / bucketSize);
        octave = bucket + 5;
      };
    }

    var COLORS = {}

    function getRandomColor() {
      var colors = [
        [255, 106, 179],
        [255, 213, 92],
        [0, 251, 255],
        [241, 134, 12],
        [0, 197, 255],
        [255, 213, 92],
        [0, 142, 255],
        [142, 99, 255],
        [0, 244, 243],
        [211, 254, 61],
        [221, 255, 103]
      ];
      return colors[Math.floor(Math.random(colors.length))];
    }

    function ToggleInstrument(p1, p2, minX, minY, options) {
      this.p1 = p1;
      this.p2 = p2;
      this.minX = minX;
      this.minY = minY;
      this.noteToPlay = options.note || 1
      this.duration = options.duration || '8n';
      // 1 = start of animation, 0 end/not animating
      this.animation = 0;

      this.toggle = true

      this.debug = false;

      this.getNote = function() {
        var chord = teoria.chord(CUR_CHORD);
        var root = chord.notes()[0].name()
        var quality = chord.quality();
        if (quality.indexOf("dim") != -1) {
          quality = "minor";
        } else if (quality.indexOf("aug") != -1 || quality.indexOf("dom") != -1) {
          quality = "major";
        }


        var scale = teoria.scale(root, quality).scale;
        var interval = scale[this.noteToPlay % 7];
        var note = teoria.note(root);
        return note.interval(interval).name();
      };

      this.getColor = function() {
        if (!COLORS[this.noteToPlay]) {
          var colors = getRandomColor();
          COLORS[this.noteToPlay] = colors;
        } else {
          var colors = COLORS[this.noteToPlay];
        }
        var with_alpha = colors.concat([this.animation]);
        return "rgba(" + with_alpha.join(",") + ")";
      };

      this.activate = function() {
        if (this.active) {
          if (this.animation < 0.2) {
            this.animation = 1;
          }
          return;
        }

        this.active = true;
        this.animation = 1;
        // console.log("TRIGGERING TOGGLE FOR", this.p1, this.p2);

        if (faceIsStable) {
          var note = `${this.getNote()}${this.getOctave()}`
          console.log("TRIGGERING", note);
          synth.triggerAttackRelease(note, this.duration, Tone.now(), volume);
        }
      }

      this.deactivate = function() {
        if (!this.active) {
          return;
        }
        // console.log("DEACTIVATING TOGGLE FOR", this.p1, this.p2);
        this.active = false;
        synth.triggerRelease([`${this.getNote()}${this.getOctave()}`]);
      }


      this.getOctave = function() {
        return octave || 5;
      }

      this.setThreshold = function() {
        this.minX = this.deltaX || this.minX;
        this.minY = this.deltaY || this.minY;
      }

      this.checkDelta = function(face) {
        var pa1 = getAverage(face[this.p1]);
        var pa2 = getAverage(face[this.p2]);

        var deltaX = Math.abs(pa1[0] - pa2[0]);
        var deltaY = Math.abs(pa1[1] - pa2[1]);

        this.deltaX = deltaX;
        this.deltaY = deltaY;

        if (this.debug) {
          console.log("DELTA", p1, p2, deltaX, deltaY);
        }
        return (deltaY > this.minY && this.minY >= 0) || (deltaX > this.minX && this.minX >= 0);
      };

      this.setContainer = function(list) {
        this.$el = document.createElement("li");
        var button = document.createElement("button");
        var span = document.createElement("span");
        button.textContent = "Set ...";
        button.className = "hide";
        var self = this;
        button.addEventListener('click', function() {
          self.setThreshold();
        }, false);
        this.$el.append(span);
        this.$el.append(button);
        list.append(this.$el);
      }

      this.render = function() {
        var delta = this.$el.querySelector('span');
        var button = this.$el.querySelector('button');
        delta.textContent = this.p1 + ":" + this.p2 + " " +
          parseInt(this.deltaX*100) + "," + parseInt(this.deltaY*100);
        if (this.active) {
          this.$el.className = "active";
        } else {
          this.$el.className = "";
        }
      }

      this.update = function(face, normalizedFace) {
        if (this.animation > 0) {
          this.animation = this.animation / 1.05;
        }
        if (this.checkDelta(normalizedFace)) {
          this.activate();
        } else {
          this.deactivate();
        }
      }

      this.draw = function(face, canvas) {
        if (this.animation > .1) {
          var points = face[this.p1].concat(face[this.p2]);
          for (var p in points) {
            var x = points[p][0]
            var y = points[p][1]
            canvasContext = canvas.drawingContext;
            canvasContext.fillStyle = this.getColor();
            canvasContext.beginPath();
            canvasContext.arc(x, y, 20*this.animation, 0, Math.PI*2, true);
            canvasContext.closePath();
            canvasContext.fill();
          }
        }
      }
    }

    // CAN SWAP THESE TO SWITCH BETEWEN MONO AND POLY SYNTH
    const monosynth = new Tone.AMSynth().toMaster();
    const polysynth = new Tone.PolySynth(4, Tone.Synth).toMaster();
    const synth = new Tone.PolySynth(4, Tone.Synth).toMaster();
    window.SYNTH = synth;

    var octave = 3;
    var volume = 1;
    var face = {};

    // these numbers are relative to nose height. 1 = one nose height
    face.mouth = new ToggleInstrument('upperMouth', 'lowerMouth', -1, 0.65, { note: 1});
    face.pupilLeft = new ToggleInstrument('bridge', 'pupilLeft', 0.12, -1, { note: 2 });
    face.pupilRight = new ToggleInstrument('bridge', 'pupilRight', 0.12, -1, { note: 3 });
    face.eyebrowLeft = new ToggleInstrument('eyebrowLeft', 'pupilLeft', -1, 0.60, { note: 4});
    face.eyebrowRight = new ToggleInstrument('eyebrowRight', 'pupilRight', -1, 0.60, { note: 5});
    face.lip = new ToggleInstrument('upperLip', 'lowerLip', -1, 0.8, { note: 6});
    face.bridge = new SliderInstrument('bridge');


    var instruments = document.getElementById("instruments");
    var calibrate = document.getElementById('calibrate');
    calibrate.addEventListener('click', setThreshold, false);
    for (var f in face) { face[f].setContainer(instruments); }

    window.FACE = face;

    // detect face stability
    var prevSize;

    // returns the size of the face as a function of the nose bridge
    function getSize(positions) {

      var minX = positions[35][0];
      var maxX = positions[39][0];
      var minY = positions[33][1];
      var maxY = positions[62][1];

      return {
        minX : minX,
        maxX : maxX,
        minY : minY,
        maxY : maxY,
        deltaX: maxX - minX,
        deltaY: maxY - minY
      };
    }

    var POSITIONS;
    var STABLE_THRESHOLD = 20;

    var lastFew = [];

    var faceIsStable = false;
    setInterval(function() {
      if (!POSITIONS || !POSITIONS.length) {
        return;
      }

      faceIsStable = false;

      var curSize = getSize(POSITIONS);
      var curPos = getAverage(POSITIONS);

      lastFew.push([curSize.deltaX, curSize.deltaY]);
      var avg = getAverage(lastFew);

      while (lastFew.length > 15) {
        lastFew.shift();
      }

  //    console.log("AVG", avg[0], avg[1], curSize.deltaX, curSize.deltaY);

      if (Math.abs(curSize.deltaX - avg[0]) > STABLE_THRESHOLD) { return; }
      if (Math.abs(curSize.deltaY - avg[1]) > STABLE_THRESHOLD) { return; }

      faceIsStable = true;
    }, 100);

    setInterval(function() {
      if (!faceIsStable) {
        //console.log("FACE IS UNSTABLE");
      }
    }, 100);

    function drawMeters() {
      for (facePart in face) { face[facePart].render(); }
    }

    window.drawLoop = function() {
      requestAnimFrame(drawLoop);

      if (ctrack.getCurrentPosition()) {
        drawMeters();
        ctrack.draw(canvas);
        var positions = ctrack.getCurrentPosition();
        var faceWithPositions = positionsToFace(positions);
        var normalizedPositions = normalizeFace(positions);
        var faceHeight = positions[7][1] - positions[33][1];
        var distanceFromScreen = faceHeight / vidHeight;
        volume = distanceFromScreen.toFixed(2) * 4;

        POSITIONS = positions;

        for (facePart in face) {
          var ff = face[facePart];
          if (ff) {
            if (ff.draw) ff.draw(faceWithPositions, canvas);
            ff.update(faceWithPositions, normalizedPositions);
          }
        }
      } else {
        POSITIONS = null;
      }
    }

  	function makeLoops() {
        var vol = new Tone.Volume(-12);

  			//DRUMS//
  			//and a compressor
  			var drumCompress = new Tone.Compressor({
  				"threshold" : -30,
  				"ratio" : 6,
  				"attack" : 0.3,
  				"release" : 0.1
  			}).toMaster();
  			var distortion = new Tone.Distortion({
  				"distortion" : 0.4,
  				"wet" : 0.4
  			});
  			//hats
  			var hats = new Tone.Player({
  				"url" : "./audio/505/hh.[mp3|ogg]",
  				"volume" : -10,
  				"retrigger" : true,
  				"fadeOut" : 0.05
  			}).chain(distortion, drumCompress, vol);
  			var hatsLoop = new Tone.Loop({
  				"callback" : function(time){
  					hats.start(time).stop(time + 0.05);
  				},
  				"interval" : "16n",
  				"probability" : 0.8
  			}).start("1m");
  			//SNARE PART
  			snare = new Tone.Player({
  				"url" : "./audio/505/snare.[mp3|ogg]",
  				"retrigger" : true,
  				"fadeOut" : 0.1
  			}).chain(distortion, drumCompress, vol);
  			var snarePart = new Tone.Sequence(function(time, velocity){
  				snare.volume.value = Tone.gainToDb(velocity);
  				snare.start(time).stop(time + 0.1);
  			}, [null, 1, null, [1, 0.3]]).start(0);
  			kick = new Tone.MembraneSynth({
  				"pitchDecay" : 0.01,
  				"octaves" : 6,
  				"oscillator" : {
  					"type" : "square4"
  				},
  				"envelope" : {
  					"attack" : 0.001,
  					"decay" : 0.2,
  					"sustain" : 0
  				}
  			}).connect(drumCompress);
  			var kickPart = new Tone.Sequence(function(time, probability){
  				if (Math.random() < probability){
  					kick.triggerAttack("C1", time);
  				}
  			}, [1, [1, [null, 0.3]], 1, [1, [null, 0.5]], 1, 1, 1, [1, [null, 0.8]]], "2n").start(0);

  			// BASS
  			bass = new Tone.FMSynth({
  				"harmonicity" : 1,
  				"modulationIndex" : 3.5,
  				"carrier" : {
  					"oscillator" : {
  						"type" : "custom",
  						"partials" : [0, 1, 0, 2]
  					},
  					"envelope" : {
  						"attack" : 0.08,
  						"decay" : 0.3,
  						"sustain" : 0,
  					},
  				},
  				"modulator" : {
  					"oscillator" : {
  						"type" : "square"
  					},
  					"envelope" : {
  						"attack" : 0.05,
  						"decay" : 0.2,
  						"sustain" : 0.3,
  						"release" : 0.01
  					},
  				}
  			}).toMaster();

        // VOLUME for the bass part is lowered so we can hear
        // the main notes
//        bass.volume.value = -10;

        function makeSequence(chord, cb) {
          var notes = teoria.chord(chord).notes();
          var part = new Tone.Sequence(function(time, note){
            //console.log("TIME", time, event);
            cb && cb(note.name() + "2");
          }, notes, "8n");

          return part;
        }

        function playBass(note) {
          bass.triggerAttackRelease(note);
          for (var part in face) {
            if (face[part].active) {
              face[part].animation = 1;
            }
          }
        }

        function swapParts(oldPart, newPart) {
          oldPart.stop();
          newPart.start(0);
        }


        function newChord(chord) {
          var newPart = makeSequence(chord, playBass);
          swapParts(bassPart, newPart);
          bassPart = newPart;
          CUR_CHORD = chord;
        }

        var CHORDS = [ "Em", "Gm", "A7", "Bdim", "D7" ];

        var c = 0;
        setInterval(function() {
          console.log("SWITCHING TO CHORD", CHORDS[c]);
          newChord(CHORDS[c]);
          c = (c + 1) % (CHORDS.length)
        }, 2000);


        Tone.Transport.start("+0.1");
        var bassPart = makeSequence("Am", playBass);
        bassPart.start(0);


  	}

  	makeLoops();

});
