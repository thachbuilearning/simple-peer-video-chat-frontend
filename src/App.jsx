import { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard"
import Peer from "simple-peer"
import io from "socket.io-client"
import "./app.scss"

const socket = io.connect("wss://simple-peer-video-chat-app.onrender.com");
// const socket = io.connect("http://localhost:5000");

function App() {
  console.log("App is running!");
  const [me, setMe] = useState("");
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [callerName, setCallerName] = useState("");
  const [name, setName] = useState("");
  const myVideo = useRef();
  const userVideo = useRef();
  const peerRef = useRef(); // Maintain a ref for the current peer

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        if (myVideo.current) {
          myVideo.current.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error("Error accessing camera and microphone:", error);
      });

    socket.on("me", (id) => {
      setMe(id);
    });

    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });
  }, []);

  const createPeer = () => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: idToCall,
        signalData: data,
        from: me,
        name: callerName,
      });
    });

    peer.on("stream", (userStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = userStream;
      }
    });

    peer.on("error", (err) => console.log("error", err));

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    socket.on("callEnded", () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        console.log("Peer in callUser destroyed.");
      } else {
        console.log("No peer found in callUser.");
      }

      // Additional cleanup
      setReceivingCall(false);
      setCaller("");
      setCallerSignal(null);
      setCallAccepted(false);

      // Reset the userVideo's srcObject
      if (userVideo.current) {
        userVideo.current.srcObject = null;
      }
    });

    peerRef.current = peer; // Update the ref with the current peer
  };

  const callUser = (id) => {
    setIdToCall(id);
    createPeer();
  };

  const answerCall = () => {
    setCallAccepted(true);

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (userStream) => {
      userVideo.current.srcObject = userStream;
    });

    peer.on("error", (err) => console.log("error", err));

    peer.signal(callerSignal);

    socket.on("callEnded", () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        console.log("Peer in callUser destroyed.");
      } else {
        console.log("No peer found in callUser.");
      }

      // Additional cleanup
      setReceivingCall(false);
      setCaller("");
      setCallerSignal(null);
      setCallAccepted(false);

      // Reset the userVideo's srcObject
      if (userVideo.current) {
        userVideo.current.srcObject = null;
      }
    });

    peerRef.current = peer; // Update the ref with the current peer
  };

  const leaveCall = () => {
    console.log("Leaving call...");

    // Emit "callEnded" event to inform the other peer about ending the call
    socket.emit("callEnded");

    // Additional cleanup (you might want to add more cleanup logic here if needed)
    setReceivingCall(false);
    setCaller("");
    setCallerSignal(null);
    setCallAccepted(false);
    setCallEnded(true); // Set callEnded to true

    // Manually stop tracks in the stream, except for the track representing your own video
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => {
        if (track !== stream.getVideoTracks()[0]) {
          // Stop the track if it's not the video track of your own stream
          track.stop();
        }
      });
    }

    // Reset the userVideo's srcObject
    if (userVideo.current) {
      userVideo.current.srcObject = null;
    }

    // Destroy the peer connection
    if (peerRef.current) {
      // Remove stream before destroying the peer connection
      peerRef.current.removeStream(stream);
      peerRef.current.destroy();
      console.log("Peer in callUser destroyed.");
    } else {
      console.log("No peer found in callUser.");
    }
  };


  return (
    <>
      <h1 style={{ textAlign: "center", color: '#fff' }}>Zoomish</h1>
      <div className="container">
        <div className="video-container">
          <div className="video">

            {stream && <video playsInline muted ref={myVideo} autoPlay style={{ width: "300px" }} />}
          </div>
          <div className="video">
            {callAccepted && !callEnded ?
              <video playsInline ref={userVideo} autoPlay style={{ width: "300px" }} /> :
              null}
          </div>
        </div>
        <div className="myId">
          <input
            placeholder="type your name:"
            type="text"
            id="filled-basic"
            value={callerName}
            onChange={(e) => setCallerName(e.target.value)} />

          <CopyToClipboard text={me} style={{ marginBottom: "2rem" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px",
                backgroundColor: "#1976D2",
                color: "#696969",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <svg viewBox="0 0 448 512" style={{
                width: "24px",
                height: "24px",
                marginRight: "8px",
              }}><desc>clipboard</desc>
                <path
                  d="M384 336H192c-8.8 0-16-7.2-16-16V64c0-8.8 7.2-16 16-16l140.1 0L400 115.9V320c0 8.8-7.2 16-16 16zM192 384H384c35.3 0 64-28.7 64-64V115.9c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1H192c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H256c35.3 0 64-28.7 64-64V416H272v32c0 8.8-7.2 16-16 16H64c-8.8 0-16-7.2-16-16V192c0-8.8 7.2-16 16-16H96V128H64z"
                  fill="#282828" /></svg>
              Copy ID
            </button>
          </CopyToClipboard>

          <input
            type="text"
            id="filled-basic1"
            placeholder="ID to call"
            value={idToCall}
            onChange={(e) => setIdToCall(e.target.value)} />


          <div className="callButton">
            {callAccepted && !callEnded ? (
              <button
                style={{
                  backgroundColor: "#f50057",
                  color: "#6f6f6f",
                  padding: "10px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
                onClick={leaveCall}
              >
                End Call
              </button>

            ) : (
              <button
                style={{
                  backgroundColor: "#2196F3",
                  padding: "10px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  border: "none",
                }}

                onClick={() => callUser(idToCall)}
              >
                <svg viewBox="0 0 512 512" width="32px" height="32px">
                  <desc>phone</desc>
                  <path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z" />
                </svg>
              </button>

            )}
            {idToCall}
          </div>
        </div>
        <div>
          {receivingCall && !callAccepted ? (
            <div className="caller">
              <h1 >{name} is calling...</h1>
              <button
                style={{
                  backgroundColor: "#2196F3",
                  color: "#707070",
                  padding: "10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  border: "none",
                }}
                onClick={answerCall}
              >
                Answer
              </button>

            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

export default App
