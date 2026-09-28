import { Button, Grid, makeStyles, Paper, Typography } from "@material-ui/core";
import React, { useContext, useState } from "react";
import { SocketContext } from "../SocketContext";

const useStyles = makeStyles((theme) => ({
  callContainer: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "75vh",
    width: "100%",
    background: "#111",
    borderRadius: "12px",
    overflow: "hidden",
    [theme.breakpoints.down("xs")]: {
      minHeight: "60vh",
      maxHeight: "70vh",
    },
  },
  remoteVideo: {
    width: "100%",
    height: "75vh",
    objectFit: "cover",
    background: "#000",
    display: "block",
    borderRadius: "12px",
    [theme.breakpoints.down("xs")]: {
      height: "60vh",
      minHeight: "420px",
    },
  },
  localVideo: {
    width: "190px",
    height: "140px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "2px solid #fff",
    background: "#000",
    display: "block",
    position: "absolute",
    right: "20px",
    bottom: "20px",
    zIndex: 2,
    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
    [theme.breakpoints.down("xs")]: {
      width: "120px",
      height: "90px",
      right: "10px",
      bottom: "10px",
    },
  },
  swapButton: {
    position: "absolute",
    bottom: "18px",
    left: "18px",
    zIndex: 3,
    textTransform: "none",
    background: "rgba(255,255,255,0.9)",
    color: "#111",
    fontWeight: 600,
    borderRadius: "999px",
    padding: "6px 14px",
    fontSize: "0.75rem",
    minHeight: "32px",
    "&:hover": {
      background: "rgba(255,255,255,1)",
    },
    [theme.breakpoints.down("xs")]: {
      bottom: "12px",
      left: "12px",
      padding: "5px 10px",
    },
  },
  remoteLabel: {
    position: "absolute",
    top: "16px",
    left: "16px",
    zIndex: 3,
    color: "#fff",
    background: "rgba(0,0,0,0.35)",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "0.9rem",
  },
  localLabel: {
    position: "absolute",
    bottom: "12px",
    right: "12px",
    zIndex: 4,
    color: "#fff",
    background: "rgba(0,0,0,0.35)",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "0.7rem",
  },
  remoteSmall: {
    width: "100%",
    height: "55vh",
    objectFit: "cover",
    background: "#000",
    display: "block",
    borderRadius: "12px",
    [theme.breakpoints.down("xs")]: {
      height: "48vh",
      minHeight: "320px",
    },
  },
  localLarge: {
    width: "100%",
    height: "55vh",
    objectFit: "cover",
    borderRadius: "12px",
    border: "2px solid #fff",
    background: "#000",
    display: "block",
    [theme.breakpoints.down("xs")]: {
      height: "48vh",
      minHeight: "320px",
    },
  },
  noCall: {
    width: "100%",
    minHeight: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
    borderRadius: "12px",
  },
}));

const VideoPlayer = () => {
  const styles = useStyles();
  const [showRemoteFull, setShowRemoteFull] = useState(true);
  const {
    name,
    callAccepted,
    myVideoRef,
    userVideoRef,
    callEnded,
    stream,
    call,
  } = useContext(SocketContext);

  const renderRemoteVideo = () => (
    <div style={{ position: "relative", width: "100%" }}>
      <Typography className={styles.remoteLabel} variant="subtitle1">
        {call?.name || "Friend"}
      </Typography>
      <video
        playsInline
        ref={userVideoRef}
        autoPlay
        className={showRemoteFull ? styles.remoteVideo : styles.remoteSmall}
      />
    </div>
  );

  const renderLocalVideo = () => (
    <div style={{ position: "relative" }}>
      <Typography className={styles.localLabel} variant="caption">
        {name || "You"}
      </Typography>
      <video
        playsInline
        muted
        ref={myVideoRef}
        autoPlay
        className={showRemoteFull ? styles.localVideo : styles.localLarge}
      />
    </div>
  );

  if (!callAccepted || callEnded) {
    return (
      <Grid container justify="center">
        {stream && (
          <Paper style={{ padding: "16px", width: "100%" }}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {name || "Name"}
              </Typography>
              <video
                playsInline
                muted
                ref={myVideoRef}
                autoPlay
                style={{
                  width: "100%",
                  maxWidth: "420px",
                  borderRadius: "12px",
                }}
              />
            </Grid>
          </Paper>
        )}
      </Grid>
    );
  }

  return (
    <Grid container justify="center">
      <Grid item xs={12}>
        <div className={styles.callContainer}>
          {showRemoteFull ? (
            <>
              {renderRemoteVideo()}
              {stream && renderLocalVideo()}
            </>
          ) : (
            <>
              {stream && renderLocalVideo()}
              {renderRemoteVideo()}
            </>
          )}
          <Button
            variant="contained"
            className={styles.swapButton}
            onClick={() => setShowRemoteFull((prev) => !prev)}
          >
            {showRemoteFull ? "Show me big" : "Show friend big"}
          </Button>
        </div>
      </Grid>
    </Grid>
  );
};

export default VideoPlayer;
