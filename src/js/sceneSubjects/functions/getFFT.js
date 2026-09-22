import {fft} from 'fft-js';

export function getNormalizedSpectrumAmp(Y, signalLength) {
  const safeLength = Math.max(1, Number(signalLength) || 1);
  const spectrumLength = Array.isArray(Y) ? Y.length : 0;
  const nyquistIndex = spectrumLength > 0 ? spectrumLength / 2 : -1;

  return (Y || []).map(([re, im], index) => {
    const magnitude = Math.hypot(re, im);
    const isDc = index === 0;
    const isNyquist = spectrumLength % 2 === 0 && index === nyquistIndex;
    const scale = (isDc || isNyquist) ? 1 / safeLength : 2 / safeLength;
    return magnitude * scale;
  });
}

export function getFFT(fftAngleTrack, sample_freq) {
    
  const x = fftAngleTrack;
  const oriTrackLength = x.length;
  const Fs = sample_freq;

  function padToPow2(arr) {
    const n = arr.length;
    const pow2 = 1 << Math.ceil(Math.log2(n)); // Next power of 2
    return [...arr, ...Array(pow2 - n).fill(0)];
  }
  const Xpad = padToPow2(x);
  const N = Xpad.length;
  // const Y = fft(Xpad).map(([re, im]) => [re/L, im/L]);
  const Y = fft(Xpad);  // No need to normalize unless comparison is demanded
  // const f = Array.from({length: N}, (_, k) => Fs * k / N);
  const f = Array.from({length: N}, (_, k) => {
    return (k < N/2) ? Fs * k / N : Fs * (k - N) / N;
  });
  const amp = getNormalizedSpectrumAmp(Y, oriTrackLength);
  const angle = Y.map(([re, im]) => Math.atan2(im, re));

  let maxFreqIdx = 1;
  let maxFreqAmp = 0;
  for (let i = 2; i < amp.length/2; i++) {
    if (amp[i] > amp[maxFreqIdx]) {
      maxFreqIdx = i;
      maxFreqAmp = amp[i];
    }
  }

  return {Y,f,amp,angle,maxFreqIdx,maxFreqAmp,oriTrackLength};
}
