import {ifft} from 'fft-js';

export function getIFFT(newY, oriTrackLength){
    // Get new MPAmp
    const newMPAmp = ifft(newY);

    return newMPAmp
    .map(([re, im]) => re)
    .slice(0, oriTrackLength);  // Get off the padding length
}