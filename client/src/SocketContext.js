import { createContext, useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { io } from "socket.io-client";

const SocketContext = createContext();

// Connect to backend URL from env. For combined deploys prefer same origin.
const backendUrl =
  process.env.REACT_APP_BACKEND_URL ||
  (typeof window !== "undefined" ? window.location.origin : "/");

const socketOptions = {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
};

const socket = io(backendUrl, socketOptions);
const peerConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 0,
};

// Debug logs for socket connection
console.log("Socket backendUrl:", backendUrl);
socket.on("connect", () => console.log("Socket connected (client)", socket.id));
socket.on("connect_error", (err) =>
  console.error("Socket connect_error (client):", err),
);
socket.on("disconnect", (reason) =>
  console.log("Socket disconnected (client):", reason),
);

const SocketContextProvider = ({ children }) => {
  const [stream, setStream] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [me, setMe] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [call, setCall] = useState(null);
  const [callEnded, setCallEnded] = useState(false);
  const [callAccepted, setCallAccepted] = useState(false);
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [name, setName] = useState("");
  const myVideoRef = useRef();
  const userVideoRef = useRef();
  const connectPeerRef = useRef();

  const setMyVideoRef = (node) => {
    myVideoRef.current = node;
    if (node && stream) {
      node.srcObject = stream;
      node.muted = true;
      node.play?.().catch(() => {});
    }
  };

  const attachLocalStream = (currentStream) => {
    if (!currentStream) return;

    if (myVideoRef.current) {
      myVideoRef.current.srcObject = currentStream;
      myVideoRef.current.muted = true;
    }

    if (myVideoRef.current?.play) {
      myVideoRef.current.play().catch(() => {
        console.warn(
          "Local video autoplay was blocked; user interaction is required",
        );
      });
    }
  };

  const attachRemoteStream = (remoteStream) => {
    if (!remoteStream) return;

    if (userVideoRef.current) {
      userVideoRef.current.srcObject = remoteStream;
    }

    if (userVideoRef.current?.play) {
      userVideoRef.current.play().catch(() => {
        console.warn(
          "Remote video autoplay was blocked; user interaction is required",
        );
      });
    }
  };

  useEffect(() => {
    const requestMedia = () => {
      setPermissionDenied(false);
      setPermissionError(null);
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((currentStream) => {
          setStream(currentStream);
          attachLocalStream(currentStream);
        })
        .catch((err) => {
          console.warn("getUserMedia error:", err);
          setPermissionDenied(true);
          setPermissionError(err?.message || "Permission denied");
        });
    };

    requestMedia();

    // socket event handlers
    socket.on("connect", () => setConnectionStatus("connected"));
    socket.on("disconnect", () => setConnectionStatus("disconnected"));
    socket.on("connect_error", () => setConnectionStatus("error"));

    socket.on("me", (id) => setMe(id));

    socket.on("calluser", ({ from, name: callerName, signal }) => {
      console.log(`Incoming call from=${from} name=${callerName}`);
      setCallEnded(false);
      setCallAccepted(false);
      setCall({ isReceivingCall: true, from, name: callerName, signal });
      setRemotePeerId(from);
    });

    socket.on("callaccepted", (signal) => {
      console.log("Received callaccepted event in useEffect");
      setCallEnded(false);
      setCallAccepted(true);
      setCall((prevCall) =>
        prevCall ? { ...prevCall, isReceivingCall: false } : prevCall,
      );
      if (connectPeerRef.current) {
        connectPeerRef.current.signal(signal);
      }
    });

    // cleanup listeners on unmount
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("me");
      socket.off("calluser");
      socket.off("callaccepted");
    };
  }, []);

  const requestPermissions = async () => {
    try {
      setPermissionDenied(false);
      setPermissionError(null);
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(currentStream);
      attachLocalStream(currentStream);
      return true;
    } catch (err) {
      console.warn("requestPermissions error:", err);
      setPermissionDenied(true);
      setPermissionError(err?.message || "Permission denied");
      return false;
    }
  };

  const answerCall = () => {
    if (!call?.from || !call?.signal) {
      console.warn("Cannot answer call: missing caller info or signal");
      return;
    }

    if (!stream) {
      console.warn("Cannot answer call: local media stream not available");
      return;
    }

    setCallEnded(false);
    setCallAccepted(true);
    setCall((prevCall) =>
      prevCall ? { ...prevCall, isReceivingCall: false } : prevCall,
    );

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: peerConfig,
    });

    peer.on("signal", (data) => {
      const target = call.from;
      console.log(`Emitting answercall to=${target}`);
      if (target) {
        socket.emit("answercall", { signal: data, to: target });
      }
    });

    peer.on("stream", (currentStream) => {
      attachRemoteStream(currentStream);
    });

    peer.on("track", (track, currentStream) => {
      if (currentStream) {
        attachRemoteStream(currentStream);
      } else if (track) {
        const streamWithTrack = new MediaStream([track]);
        attachRemoteStream(streamWithTrack);
      }
    });

    peer.on("error", (err) => {
      console.error("Peer error on callee side:", err);
    });

    peer.signal(call.signal);

    connectPeerRef.current = peer;
    setRemotePeerId(call.from);
  };
  const callUser = (id) => {
    if (!id) {
      console.warn("Cannot call user: missing ID");
      return;
    }

    if (!stream) {
      console.warn("Cannot call user: local media stream not available");
      return;
    }

    setCallEnded(false);
    setCallAccepted(false);
    setCall({
      isReceivingCall: false,
      from: id,
      name: "Calling...",
      signal: null,
    });
    setRemotePeerId(id);

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: peerConfig,
    });

    peer.on("signal", (data) => {
      const callerId = me || socket.id;
      console.log(`Emitting calluser from=${callerId} to=${id}`);
      socket.emit("calluser", {
        userToCall: id,
        signalData: data,
        from: callerId,
        name,
      });
    });

    peer.on("stream", (currentStream) => {
      attachRemoteStream(currentStream);
    });

    peer.on("track", (track, currentStream) => {
      if (currentStream) {
        attachRemoteStream(currentStream);
      } else if (track) {
        const streamWithTrack = new MediaStream([track]);
        attachRemoteStream(streamWithTrack);
      }
    });

    peer.on("error", (err) => {
      console.error("Peer error on caller side:", err);
    });

    peer.on("close", () => {
      console.log("Peer closed on caller side");
    });

    connectPeerRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    setCallAccepted(false);
    setCall(null);
    if (connectPeerRef.current) {
      connectPeerRef.current.destroy();
      connectPeerRef.current = null;
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
    const targetPeer = remotePeerId || call?.from || null;
    if (targetPeer) {
      socket.emit("callended", { to: targetPeer });
    }
    setRemotePeerId(null);
    // avoid forced page reload so the remote peer can also cleanup normally
  };

  useEffect(() => {
    const handleCallEnded = () => {
      console.log("Received callended event");
      setCallEnded(true);
      setCallAccepted(false);
      setCall(null);
      setRemotePeerId(null);
      if (connectPeerRef.current) {
        connectPeerRef.current.destroy();
        connectPeerRef.current = null;
      }
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = null;
      }
    };

    socket.on("callended", handleCallEnded);

    return () => {
      socket.off("callended", handleCallEnded);
    };
  }, [call]);

  return (
    <SocketContext.Provider
      value={{
        call,
        callAccepted,
        myVideoRef,
        setMyVideoRef,
        userVideoRef,
        stream,
        permissionDenied,
        permissionError,
        connectionStatus,
        requestPermissions,
        name,
        setName,
        me,
        callEnded,
        callUser,
        leaveCall,
        answerCall,
        connectPeerRef,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContextProvider, SocketContext };
