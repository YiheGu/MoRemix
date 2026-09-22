import { PCA } from 'ml-pca';

export function getPCAResult(PspaceAnimTrack){
    const pca = new PCA(PspaceAnimTrack, { center: false });  // Not centered
    const score = pca.predict(PspaceAnimTrack);  
    const coeff = pca.getEigenvectors();   
    const explained = pca.getExplainedVariance(); 
    // Keep the decomposition uncentered, but report the mean bone vector.
    const mu = PspaceAnimTrack[0].map((_, axis) =>
        PspaceAnimTrack.reduce((sum, frame) => sum + frame[axis], 0) / PspaceAnimTrack.length
    );

    const bonePCA = {
        score,
        mu,
        coeff,
        explained
    };

    return bonePCA;
}
