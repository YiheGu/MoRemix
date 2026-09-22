export function getMPAngleAndV3Loc(PCAResult) {
    const cur_score_loc = PCAResult.score.data;      // N × 3
    const explained = PCAResult.explained;      // [e1, e2, e3]

    // Decide which two-axis form the 2D PCA space
    const sortedIndices = explained
        .map((v, idx) => [v, idx])
        .sort((a, b) => b[0] - a[0])
        .map(pair => pair[1]);

    const [v1_index, v2_index] = sortedIndices;
    const v3_index = sortedIndices[2];
    const pcaExplainedRatio = explained[v2_index] / explained[v3_index];

    // Get PCALoc data
    const cur_v1 = cur_score_loc.map(row => row[v1_index]);
    const cur_v2 = cur_score_loc.map(row => row[v2_index]);

    // Calculate projection length
    const pcaProLen = cur_v1.map((v, k) => Math.hypot(v, cur_v2[k]));
    let cur_score_angle = cur_v1.map((v, k) => {
        let angle = Math.atan2(cur_v2[k], v);
        return angle < 0 ? angle + 2 * Math.PI : angle;
    });

    // Fix angle jump bug
    for (let k = 1; k < cur_score_angle.length; k++) {
        let delta = cur_score_angle[k] - cur_score_angle[k - 1];
        if (delta > Math.PI) {
            for (let m = k; m < cur_score_angle.length; m++) cur_score_angle[m] -= 2 * Math.PI;
        } else if (delta < -Math.PI) {
            for (let m = k; m < cur_score_angle.length; m++) cur_score_angle[m] += 2 * Math.PI;
        }
    }

    // Get pca angle, mean, amp
    const pcaAngle = cur_score_angle;
    const pcaMean = cur_score_angle.reduce((sum, v) => sum + v, 0) / cur_score_angle.length;
    const pcaAmp = cur_score_angle.map(v => v - pcaMean);

    // Get third axis loc, mean, amp
    const v3Loc = cur_score_loc.map(row => row[v3_index]);
    const v3Mean = v3Loc.reduce((sum, v) => sum + v, 0) / v3Loc.length;
    const v3Amp = v3Loc.map(v => v - v3Mean);

    return [pcaAngle,pcaMean,pcaAmp,pcaProLen,pcaExplainedRatio,v1_index,v2_index,v3_index,v3Loc,v3Mean,v3Amp];
}