/* global clm, Tone, requestAnimFrame */
document.addEventListener("DOMContentLoaded", function() {
  var vid = document.getElementById('videoel');
  var recordedVideo = document.querySelector('video#recorded');
  var mediaSource = new MediaSource();
  mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
  var mediaRecorder;
  var recordedBlobs;
  var sourceBuffer;
  var vidWidth = vid.width;
  var vidHeight = vid.height;
  var overlay = document.getElementById('overlay');
  var overlayCC = overlay.getContext('2d');
  var width = vid.offsetWidth;
  var height = vid.offsetHeight;
  var k = 5;
  var bucketSize = width / k;


  var constraints = {
    audio: true,
    video: true
  };

  var recordButton = document.querySelector('button#record');
  var playButton = document.querySelector('button#play');
  var downloadButton = document.querySelector('button#download');
  recordButton.onclick = toggleRecording;
  playButton.onclick = play;
  downloadButton.onclick = download;

  /* Setup of video/webcam and checking for webGL support */
  function enablestart() {
    var startbutton = document.getElementById('startbutton');
    startbutton.value = "start";
    startbutton.disabled = null;
    startbutton.addEventListener("click", startVideo);
  }


  function adjustVideoProportions() {
    // resize overlay and video if proportions of video are not 4:3
    // keep same height, just change width
    var proportion = vid.videoWidth/vid.videoHeight;
    vidWidth = Math.round(vidHeight * proportion);
    vid.width = vidWidth;
    overlay.width = vidWidth;
  }

  // gum = get user media
  function gumSuccess(stream) {
    // add camera stream if getUserMedia succeeded
    recordButton.disabled = false;
    window.stream = stream;
    if ("srcObject" in vid) {
      vid.srcObject = stream;
    } else {
      vid.src = (window.URL && window.URL.createObjectURL(stream));
    }
    vid.onloadedmetadata = function() {
      adjustVideoProportions();
      vid.play();
    }
    vid.onresize = function() {
      adjustVideoProportions();
      if (trackingStarted) {
        ctrack.stop();
        ctrack.reset();
        ctrack.start(vid);
      }
    }
  }

  function getCenterOfElement(el) {
    const offsetTop = el.offsetTop;
    const offsetLeft = el.offsetLeft;
    var width = el.offsetWidth;
    var height = el.offsetHeight;
    return {
      'centerX': offsetLeft + width / 2,
      'centerY': offsetTop + height / 2
    };
  }

  function gumFail() {
    document.getElementById('gum').className = "hide";
    document.getElementById('nogum').className = "nohide";
    alert("There was some problem trying to fetch video from your webcam.");
  }

  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;
  // set up video
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia(constraints).then(gumSuccess).catch(gumFail);
  } else if (navigator.getUserMedia) {
    navigator.getUserMedia({video : true}, gumSuccess, gumFail);
  } else {
    gumFail();
  }

  vid.addEventListener('canplay', enablestart, false);

    function handleSourceOpen(event) {
    console.log('MediaSource opened');
    sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
    console.log('Source buffer: ', sourceBuffer);
  }

  recordedVideo.addEventListener('error', function(ev) {
    console.error('MediaRecording.recordedMedia.error()');
    alert('Your browser can not play\n\n' + recordedVideo.src
      + '\n\n media clip. event: ' + JSON.stringify(ev));
  }, true);

  function handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
      recordedBlobs.push(event.data);
    }
  }

  function handleStop(event) {
    console.log('Recorder stopped: ', event);
  }

  function toggleRecording() {
    if (recordButton.textContent === 'Start Recording') {
      startRecording();
    } else {
      stopRecording();
      recordButton.textContent = 'Start Recording';
      playButton.disabled = false;
      downloadButton.disabled = false;
    }
  }

  function startRecording() {
    recordedBlobs = [];
    var options = {mimeType: 'video/webm;codecs=vp9'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log(options.mimeType + ' is not Supported');
      options = {mimeType: 'video/webm;codecs=vp8'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log(options.mimeType + ' is not Supported');
        options = {mimeType: 'video/webm'};
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.log(options.mimeType + ' is not Supported');
          options = {mimeType: ''};
        }
      }
    }
    try {
      mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e) {
      console.error('Exception while creating MediaRecorder: ' + e);
      alert('Exception while creating MediaRecorder: '
        + e + '. mimeType: ' + options.mimeType);
      return;
    }
    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = 'Stop Recording';
    playButton.disabled = true;
    downloadButton.disabled = true;
    mediaRecorder.onstop = handleStop;
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start(10); // collect 10ms of data
    console.log('MediaRecorder started', mediaRecorder);
  }

  function stopRecording() {
    mediaRecorder.stop();
    console.log('Recorded Blobs: ', recordedBlobs);
    recordedVideo.controls = true;
  }

  function play() {
    var superBuffer = new Blob(recordedBlobs, {type: 'video/webm'});
    recordedVideo.src = window.URL.createObjectURL(superBuffer);
    // workaround for non-seekable video taken from
    // https://bugs.chromium.org/p/chromium/issues/detail?id=642012#c23
    recordedVideo.addEventListener('loadedmetadata', function() {
      if (recordedVideo.duration === Infinity) {
        recordedVideo.currentTime = 1e101;
        recordedVideo.ontimeupdate = function() {
          recordedVideo.currentTime = 0;
          recordedVideo.ontimeupdate = function() {
            delete recordedVideo.ontimeupdate;
            recordedVideo.play();
          };
        };
      }
    });
  }

  function download() {
    var blob = new Blob(recordedBlobs, {type: 'video/webm'});
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'test.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  /** Code for face tracking **/
  var ctrack = new clm.tracker();
  ctrack.init();
  var trackingStarted = false;

  function startVideo() {
    // start video
    vid.play();
    // start tracking
    ctrack.start(vid);
    trackingStarted = true;
    // start loop to draw face
    drawLoop();
  }

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


  function SliderInstrument(part) {
    this.slider = true

    let { centerX, centerY } = getCenterOfElement(vid);

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
      overlayCC.fillStyle="#FF0a00";
      overlayCC.fillRect(centerX, centerY, 5, 5);

      var avg = getAverage(facePositions[part]);
      this.deltaX = Math.floor(centerX - avg[0]);
      this.deltaY = Math.floor(centerY - avg[1]);

      var bucket = Math.floor(this.deltaX / bucketSize);
      octave = bucket + 5;
    };
  }

  function ToggleInstrument(p1, p2, minX, minY, options) {
    this.p1 = p1;
    this.p2 = p2;
    this.minX = minX;
    this.minY = minY;
    this.noteToPlay = options.note || 'a';
    this.duration = options.duration || '8n';

    this.toggle = true

    this.debug = false;

    this.getNote = function() {
      return this.noteToPlay;
    };

    this.activate = function() {
      if (this.active) {
        return;
      }

      this.active = true;
      console.log("TRIGGERING TOGGLE FOR", this.p1, this.p2);

      if (faceIsStable) {
        synth.triggerAttackRelease(`${this.getNote()}${this.getOctave()}`, this.duration, Tone.now(), volume);
      }
    }

    this.deactivate = function() {
      if (!this.active) {
        return;
      }

      console.log("DEACTIVATING TOGGLE FOR", this.p1, this.p2);
      this.active = false;
      synth.triggerRelease([`${this.getNote()}${this.getOctave()}`]);
    }

    this.getOctave = function() {
      return octave;
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

    this.setContainer = function(div) {
      this.$el = document.createElement("div");
      div.append(this.$el);
    }

    this.render = function() {
      this.$el.textContent = this.p1 + ":" + this.p2 + " " +
        parseInt(this.deltaX*100) + "," + parseInt(this.deltaY*100);
      if (this.active) {
        this.$el.className = "active";
      } else {
        this.$el.className = "";
      }

    }

    this.update = function(face, normalizedFace) {
      if (this.checkDelta(normalizedFace)) {
        this.activate();
      } else {
        this.deactivate();
      }
    }
  }

  function map (num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  }

  // CAN SWAP THESE TO SWITCH BETEWEN MONO AND POLY SYNTH
  const monosynth = new Tone.AMSynth().toMaster();
  const polysynth = new Tone.PolySynth(4, Tone.Synth).toMaster();
  const synth = new Tone.PolySynth(4, Tone.Synth).toMaster();

  var octave = 3;
  var volume = 1;
  var face = {};

  // these numbers are relative to nose height. 1 = one nose height
  face.mouth = new ToggleInstrument('upperMouth', 'lowerMouth', -1, 0.65, { note: 'a'});
  face.pupilLeft = new ToggleInstrument('bridge', 'pupilLeft', 0.12, -1, { note: 'f' });
  face.pupilRight = new ToggleInstrument('bridge', 'pupilRight', 0.12, -1, { note: 'b' });
  face.eyebrowLeft = new ToggleInstrument('eyebrowLeft', 'pupilLeft', -1, 0.60, { note: 'd'});
  face.eyebrowRight = new ToggleInstrument('eyebrowRight', 'pupilRight', -1, 0.60, { note: 'e'});
  face.lip = new ToggleInstrument('upperLip', 'lowerLip', -1, 0.8, { note: 'g'});
  face.bridge = new SliderInstrument('bridge');


  var c = document.getElementById("instruments");
  for (var f in face) { face[f].setContainer(c); }

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
      console.log("FACE IS UNSTABLE");
    }
  }, 100);

  function drawMeters() {
    for (facePart in face) { face[facePart].render(); }
  }

  function drawLoop() {
    requestAnimFrame(drawLoop);
    overlayCC.clearRect(0, 0, vidWidth, vidHeight);
    if (ctrack.getCurrentPosition()) {
      drawMeters();

      ctrack.draw(overlay);
      var positions = ctrack.getCurrentPosition();
      var faceWithPositions = positionsToFace(positions);
      var normalizedPositions = normalizeFace(positions);
      var faceHeight = positions[7][1] - positions[33][1];
      var distanceFromScreen = faceHeight / height;
      volume = distanceFromScreen.toFixed(2);

      POSITIONS = positions;

      for (facePart in face) {
        var ff = face[facePart];
        if (ff) {
          ff.update(faceWithPositions, normalizedPositions);
        }
      }
    } else {
      POSITIONS = null;
    }
  }
});
