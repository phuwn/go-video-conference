"use strict";

const startButton = document.getElementById("startButton");
const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");
callButton.disabled = true;
hangupButton.disabled = true;
startButton.addEventListener("click", start);
callButton.addEventListener("click", call);
hangupButton.addEventListener("click", hangup);

const selfCam = document.getElementById("selfCam");
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

let localStream;
let conn;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1,
};
let map = new Map();

async function start() {
  startButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    selfCam.srcObject = stream;
    localStream = stream;
    callButton.disabled = false;
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
  }
}

async function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  if (window["WebSocket"]) {
    conn = new WebSocket("ws://" + document.location.host + "/ws");
    conn.onclose = function (evt) {
      console.log("ws conn closed");
    };
    conn.onmessage = async function (evt) {
      var { typ, sender_id, receiver_id, data } = JSON.parse(evt.data);
      switch (typ) {
        case 0:
          var desc = await offer(sender_id);
          conn.send(
            JSON.stringify({ typ: 1, receiver_id: sender_id, data: desc })
          );
          break;
        case 1:
          var desc = await answer(sender_id, data);
          conn.send(
            JSON.stringify({ typ: 2, receiver_id: sender_id, data: desc })
          );
          break;
        case 2:
          updateLocal(sender_id, data);
          break;
        case 3:
          updateCandidate(sender_id, data);
          break;
        case 4:
          closePC(sender_id);
          break;
        default:
          console.log("invalid message type", typ);
      }
    };
  } else {
    alert("Your browser does not support WebSockets.");
  }
}

async function offer(id) {
  var pc = new RTCPeerConnection(configuration);
  pc.oniceconnectionstatechange = (e) =>
    console.log("ice connection state", pc.iceConnectionState);
  pc.onicecandidate = (event) => {
    conn.send(
      JSON.stringify({ typ: 3, receiver_id: id, data: event.candidate })
    );
  };
  pc.ontrack = (event) => {
    var el = document.getElementById("remote-vid-" + id);
    if (el === undefined || el === null) {
      el = document.createElement("video");
      el.setAttribute("id", "remote-vid-" + id);
      el.srcObject = event.streams[0];
      el.autoplay = true;
      document.getElementById("hub").appendChild(el);
    }
  };

  await localStream
    .getTracks()
    .forEach((track) => pc.addTrack(track, localStream));
  var d = await pc.createOffer(offerOptions);
  await pc.setLocalDescription(d);
  map.set(id, pc);

  return d;
}

async function answer(id, desc) {
  var pc = new RTCPeerConnection(configuration);
  pc.oniceconnectionstatechange = (e) => console.log(pc.iceConnectionState);
  pc.onicecandidate = (event) => {
    conn.send(
      JSON.stringify({ typ: 3, receiver_id: id, data: event.candidate })
    );
  };
  pc.ontrack = (event) => {
    var el = document.getElementById("remote-vid-" + id);
    if (el === undefined || el === null) {
      el = document.createElement("video");
      el.setAttribute("id", "remote-vid-" + id);
      el.srcObject = event.streams[0];
      el.autoplay = true;
      document.getElementById("hub").appendChild(el);
      return;
    }
  };

  await localStream
    .getTracks()
    .forEach((track) => pc.addTrack(track, localStream));
  pc.setRemoteDescription(desc);
  var d = await pc.createAnswer();
  await pc.setLocalDescription(d);
  map.set(id, pc);

  return d;
}

function updateLocal(id, desc) {
  var pc = map.get(id);
  if (pc === undefined || pc === null) {
    console.log("invalid pc", desc);
    return;
  }
  pc.setRemoteDescription(desc);
}

function updateCandidate(id, candidate) {
  var pc = map.get(id);
  if (pc === undefined || pc === null) {
    console.log("invalid pc", desc);
    return;
  }
  pc.addIceCandidate(candidate);
}

function closePC(id) {
  var pc = map.get(id);
  if (pc === undefined || pc === null) {
    console.log("invalid pc", desc);
    return;
  }
  pc.close();
  map.delete(id);
  var el = document.getElementById("remote-vid-" + id);
  el.remove();
}

function hangup() {
  map.forEach((pc, id) => {
    pc.close();
    map.delete(id);
    var el = document.getElementById("remote-vid-" + id);
    el.remove();
  });
  conn.close();
  hangupButton.disabled = true;
  callButton.disabled = false;
}
