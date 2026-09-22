const intro = document.querySelector("#intro");
let toolPromise = null;

function setIntroVisible(isVisible) {
  intro.classList.toggle("is-hidden", !isVisible);
}

if (!history.state || !history.state.brmPage) {
  history.replaceState({ brmPage: "intro" }, "", location.pathname + location.search);
}

window.BRMIntroPage = {
  show: () => setIntroVisible(true),
  hide: () => setIntroVisible(false),
};

window.addEventListener("popstate", (event) => {
  setIntroVisible(event.state?.brmPage === "intro");
});

document.querySelector("#enter-tool").addEventListener("click", async () => {
  setIntroVisible(false);
  history.pushState({ brmPage: "format" }, "", location.pathname + location.search);
  toolPromise ||= import("./main.js");
  await toolPromise;
  window.BRMToolNavigation?.sync?.();
});

const syncedVideos = Array.from(document.querySelectorAll(".video-strip video"));

if (syncedVideos.length > 1) {
  const leadVideo = syncedVideos[0];
  let shouldResumeVideos = true;

  function playAllVideos() {
    syncedVideos.forEach((video) => {
      video.muted = true;
      video.playsInline = true;
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {});
    });
  }

  function pauseAllVideos() {
    syncedVideos.forEach((video) => {
      if (!video.paused && !video.ended) video.pause();
    });
  }

  function alignVideosTo(time) {
    syncedVideos.forEach((video) => {
      if (!Number.isFinite(video.duration) || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
      const safeTime = video.duration > 0 ? Math.min(time, Math.max(0, video.duration - 0.05)) : time;
      if (Math.abs(video.currentTime - safeTime) > 0.08) video.currentTime = safeTime;
    });
  }

  function prepareVideo(video) {
    video.muted = true;
    video.playsInline = true;
    video.load();
    video.addEventListener("loadeddata", () => {
      alignVideosTo(leadVideo.currentTime || 0);
      playAllVideos();
    });
    video.addEventListener("canplay", () => {
      playAllVideos();
    });
    video.addEventListener("error", () => {
      const source = video.currentSrc || video.querySelector("source")?.src || "unknown source";
      console.warn("Intro video failed to load:", source, video.error);
    });
  }

  syncedVideos.forEach(prepareVideo);
  leadVideo.addEventListener("seeked", () => alignVideosTo(leadVideo.currentTime || 0));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      shouldResumeVideos = syncedVideos.some((video) => !video.paused && !video.ended);
      pauseAllVideos();
      return;
    }

    alignVideosTo(leadVideo.currentTime || 0);
    if (shouldResumeVideos) playAllVideos();
  });
  playAllVideos();
}
