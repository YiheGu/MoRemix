import { SkeletalMotion } from '../sceneSubjects/SkeletalMotion';
import { getBoneInfo } from '../sceneSubjects/functions/getBoneInfo';

// ---- Stat helpers ----
function arrMean(a) {
    if (!Array.isArray(a) || a.length === 0) return null;
    return a.reduce((s, v) => s + v, 0) / a.length;
}
function arrStd(a) {
    const mean = arrMean(a);
    if (mean === null) return null;
    return Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length);
}
function arrMin(a) { return (Array.isArray(a) && a.length) ? Math.min(...a) : null; }
function arrMax(a) { return (Array.isArray(a) && a.length) ? Math.max(...a) : null; }
function arrRMS(a) {
    if (!Array.isArray(a) || a.length === 0) return null;
    return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
}

const RAD_TO_DEG = 180 / Math.PI;

// ml-matrix Matrix helpers (bone.PCAResult.score / coeff are Matrix objects)
function matrixCol(matrix, colIdx) {
    if (!matrix || typeof matrix.getColumn !== 'function') return null;
    try { return Array.from(matrix.getColumn(colIdx)); } catch { return null; }
}
function matrixGet(matrix, row, col) {
    if (!matrix || typeof matrix.get !== 'function') return null;
    try { return matrix.get(row, col); } catch { return null; }
}

// ---- Field manifest — all data fields written by getBoneInfo ----
// label:  shown in UI under the group header (short)
// header: CSV column name (full dot-path, unambiguous)
// Skipped (non-data): Ori.QuatAnimTrack (THREE.js obj), all plot fields,
//   MPFFTResult.Y (redundant: captured by amp+angle), bone.New (duplicate of Ori)
const FIELD_CATALOG_GROUPS = [
    // ── bone-level scalars ──────────────────────────────────────────────────
    {
        group: 'Basic',
        hint: 'Scalar values stored directly on bone',
        fields: [
            { id: 'b_nframes',  label: 'nFrames',     header: 'nFrames',     extract: b => b.nFrames },
            { id: 'b_freq',     label: 'sample_freq', header: 'sample_freq', extract: b => b.sample_freq },
            { id: 'b_v1idx',    label: 'V1Idx',       header: 'V1Idx',       extract: b => b.V1Idx },
            { id: 'b_v2idx',    label: 'V2Idx',       header: 'V2Idx',       extract: b => b.V2Idx },
            { id: 'b_v3idx',    label: 'V3Idx',       header: 'V3Idx',       extract: b => b.V3Idx },
        ],
    },
    // ── bone.PCAResult ──────────────────────────────────────────────────────
    {
        group: 'PCAResult',
        hint: 'bone.PCAResult — PCA on Ori.PspaceAnimTrack; score & coeff are ml-matrix Matrix objects',
        fields: [
            // explained — eigenvalues array [e0, e1, e2]
            { id: 'pca_e0', label: 'explained[0]', header: 'PCAResult.explained[0]', extract: b => b.PCAResult?.explained?.[0] },
            { id: 'pca_e1', label: 'explained[1]', header: 'PCAResult.explained[1]', extract: b => b.PCAResult?.explained?.[1] },
            { id: 'pca_e2', label: 'explained[2]', header: 'PCAResult.explained[2]', extract: b => b.PCAResult?.explained?.[2] },
            // mu — column means (zeros when center:false)
            { id: 'pca_mu0', label: 'mu[0]', header: 'PCAResult.mu[0]', extract: b => b.PCAResult?.mu?.[0] },
            { id: 'pca_mu1', label: 'mu[1]', header: 'PCAResult.mu[1]', extract: b => b.PCAResult?.mu?.[1] },
            { id: 'pca_mu2', label: 'mu[2]', header: 'PCAResult.mu[2]', extract: b => b.PCAResult?.mu?.[2] },
            // score — N×3 Matrix of projected coordinates, per-column summaries
            { id: 'pca_s0_mean', label: 'score[0]: Mean', header: 'PCAResult.score[0].Mean', extract: b => arrMean(matrixCol(b.PCAResult?.score, 0)) },
            { id: 'pca_s0_std',  label: 'score[0]: Std',  header: 'PCAResult.score[0].Std',  extract: b => arrStd(matrixCol(b.PCAResult?.score, 0)) },
            { id: 'pca_s0_min',  label: 'score[0]: Min',  header: 'PCAResult.score[0].Min',  extract: b => arrMin(matrixCol(b.PCAResult?.score, 0)) },
            { id: 'pca_s0_max',  label: 'score[0]: Max',  header: 'PCAResult.score[0].Max',  extract: b => arrMax(matrixCol(b.PCAResult?.score, 0)) },
            { id: 'pca_s1_mean', label: 'score[1]: Mean', header: 'PCAResult.score[1].Mean', extract: b => arrMean(matrixCol(b.PCAResult?.score, 1)) },
            { id: 'pca_s1_std',  label: 'score[1]: Std',  header: 'PCAResult.score[1].Std',  extract: b => arrStd(matrixCol(b.PCAResult?.score, 1)) },
            { id: 'pca_s1_min',  label: 'score[1]: Min',  header: 'PCAResult.score[1].Min',  extract: b => arrMin(matrixCol(b.PCAResult?.score, 1)) },
            { id: 'pca_s1_max',  label: 'score[1]: Max',  header: 'PCAResult.score[1].Max',  extract: b => arrMax(matrixCol(b.PCAResult?.score, 1)) },
            { id: 'pca_s2_mean', label: 'score[2]: Mean', header: 'PCAResult.score[2].Mean', extract: b => arrMean(matrixCol(b.PCAResult?.score, 2)) },
            { id: 'pca_s2_std',  label: 'score[2]: Std',  header: 'PCAResult.score[2].Std',  extract: b => arrStd(matrixCol(b.PCAResult?.score, 2)) },
            { id: 'pca_s2_min',  label: 'score[2]: Min',  header: 'PCAResult.score[2].Min',  extract: b => arrMin(matrixCol(b.PCAResult?.score, 2)) },
            { id: 'pca_s2_max',  label: 'score[2]: Max',  header: 'PCAResult.score[2].Max',  extract: b => arrMax(matrixCol(b.PCAResult?.score, 2)) },
            // coeff — 3×3 eigenvector Matrix (column = PC direction in 3D space)
            { id: 'pca_c00', label: 'coeff[0][0]', header: 'PCAResult.coeff[0][0]', extract: b => matrixGet(b.PCAResult?.coeff, 0, 0) },
            { id: 'pca_c10', label: 'coeff[1][0]', header: 'PCAResult.coeff[1][0]', extract: b => matrixGet(b.PCAResult?.coeff, 1, 0) },
            { id: 'pca_c20', label: 'coeff[2][0]', header: 'PCAResult.coeff[2][0]', extract: b => matrixGet(b.PCAResult?.coeff, 2, 0) },
            { id: 'pca_c01', label: 'coeff[0][1]', header: 'PCAResult.coeff[0][1]', extract: b => matrixGet(b.PCAResult?.coeff, 0, 1) },
            { id: 'pca_c11', label: 'coeff[1][1]', header: 'PCAResult.coeff[1][1]', extract: b => matrixGet(b.PCAResult?.coeff, 1, 1) },
            { id: 'pca_c21', label: 'coeff[2][1]', header: 'PCAResult.coeff[2][1]', extract: b => matrixGet(b.PCAResult?.coeff, 2, 1) },
            { id: 'pca_c02', label: 'coeff[0][2]', header: 'PCAResult.coeff[0][2]', extract: b => matrixGet(b.PCAResult?.coeff, 0, 2) },
            { id: 'pca_c12', label: 'coeff[1][2]', header: 'PCAResult.coeff[1][2]', extract: b => matrixGet(b.PCAResult?.coeff, 1, 2) },
            { id: 'pca_c22', label: 'coeff[2][2]', header: 'PCAResult.coeff[2][2]', extract: b => matrixGet(b.PCAResult?.coeff, 2, 2) },
        ],
    },
    // ── bone.QuatUpAnimTrack ────────────────────────────────────────────────
    {
        group: 'QuatUpAnimTrack',
        hint: 'bone.QuatUpAnimTrack — [x,y,z][] roll-axis direction per frame',
        fields: [
            { id: 'qup_x_mean', label: 'X Mean', header: 'QuatUpAnimTrack.X.Mean', extract: b => arrMean(b.QuatUpAnimTrack?.map(f => f[0])) },
            { id: 'qup_x_std',  label: 'X Std',  header: 'QuatUpAnimTrack.X.Std',  extract: b => arrStd(b.QuatUpAnimTrack?.map(f => f[0])) },
            { id: 'qup_y_mean', label: 'Y Mean', header: 'QuatUpAnimTrack.Y.Mean', extract: b => arrMean(b.QuatUpAnimTrack?.map(f => f[1])) },
            { id: 'qup_y_std',  label: 'Y Std',  header: 'QuatUpAnimTrack.Y.Std',  extract: b => arrStd(b.QuatUpAnimTrack?.map(f => f[1])) },
            { id: 'qup_z_mean', label: 'Z Mean', header: 'QuatUpAnimTrack.Z.Mean', extract: b => arrMean(b.QuatUpAnimTrack?.map(f => f[2])) },
            { id: 'qup_z_std',  label: 'Z Std',  header: 'QuatUpAnimTrack.Z.Std',  extract: b => arrStd(b.QuatUpAnimTrack?.map(f => f[2])) },
        ],
    },
    // ── bone.Ori.PspaceAnimTrack ────────────────────────────────────────────
    {
        group: 'Ori.PspaceAnimTrack',
        hint: 'bone.Ori.PspaceAnimTrack — [x,y,z][] parent-space direction per frame',
        fields: [
            { id: 'psp_x_mean', label: 'X Mean', header: 'Ori.PspaceAnimTrack.X.Mean', extract: b => arrMean(b.Ori?.PspaceAnimTrack?.map(f => f[0])) },
            { id: 'psp_x_std',  label: 'X Std',  header: 'Ori.PspaceAnimTrack.X.Std',  extract: b => arrStd(b.Ori?.PspaceAnimTrack?.map(f => f[0])) },
            { id: 'psp_y_mean', label: 'Y Mean', header: 'Ori.PspaceAnimTrack.Y.Mean', extract: b => arrMean(b.Ori?.PspaceAnimTrack?.map(f => f[1])) },
            { id: 'psp_y_std',  label: 'Y Std',  header: 'Ori.PspaceAnimTrack.Y.Std',  extract: b => arrStd(b.Ori?.PspaceAnimTrack?.map(f => f[1])) },
            { id: 'psp_z_mean', label: 'Z Mean', header: 'Ori.PspaceAnimTrack.Z.Mean', extract: b => arrMean(b.Ori?.PspaceAnimTrack?.map(f => f[2])) },
            { id: 'psp_z_std',  label: 'Z Std',  header: 'Ori.PspaceAnimTrack.Z.Std',  extract: b => arrStd(b.Ori?.PspaceAnimTrack?.map(f => f[2])) },
        ],
    },
    // ── bone.Ori.keyBoneLen ─────────────────────────────────────────────────
    {
        group: 'Ori.keyBoneLen',
        hint: 'bone.Ori.keyBoneLen — number[] bone vector magnitude per frame',
        fields: [
            { id: 'kbl_mean', label: 'Mean', header: 'Ori.keyBoneLen.Mean', extract: b => arrMean(b.Ori?.keyBoneLen) },
            { id: 'kbl_std',  label: 'Std',  header: 'Ori.keyBoneLen.Std',  extract: b => arrStd(b.Ori?.keyBoneLen) },
            { id: 'kbl_min',  label: 'Min',  header: 'Ori.keyBoneLen.Min',  extract: b => arrMin(b.Ori?.keyBoneLen) },
            { id: 'kbl_max',  label: 'Max',  header: 'Ori.keyBoneLen.Max',  extract: b => arrMax(b.Ori?.keyBoneLen) },
        ],
    },
    // ── bone.Ori scalar fields ──────────────────────────────────────────────
    {
        group: 'Ori (scalars)',
        hint: 'Scalar values stored in bone.Ori',
        fields: [
            { id: 'ori_mpmean',   label: 'MPMean (rad)',      header: 'Ori.MPMean',        extract: b => b.Ori?.MPMean },
            { id: 'ori_mprange',  label: 'MPAmpRangeDeg (°)', header: 'Ori.MPAmpRangeDeg', extract: b => b.Ori?.MPAmpRangeDeg },
            { id: 'ori_v2ratio',  label: 'V2Ratio',           header: 'Ori.V2Ratio',       extract: b => b.Ori?.V2Ratio },
            { id: 'ori_v3mean',   label: 'V3Mean',            header: 'Ori.V3Mean',        extract: b => b.Ori?.V3Mean },
        ],
    },
    // ── bone.Ori.MPAngle ────────────────────────────────────────────────────
    {
        group: 'Ori.MPAngle',
        hint: 'bone.Ori.MPAngle — number[] main plane angle per frame (rad)',
        fields: [
            { id: 'mpa_mean', label: 'Mean', header: 'Ori.MPAngle.Mean', extract: b => arrMean(b.Ori?.MPAngle) },
            { id: 'mpa_std',  label: 'Std',  header: 'Ori.MPAngle.Std',  extract: b => arrStd(b.Ori?.MPAngle) },
            { id: 'mpa_min',  label: 'Min',  header: 'Ori.MPAngle.Min',  extract: b => arrMin(b.Ori?.MPAngle) },
            { id: 'mpa_max',  label: 'Max',  header: 'Ori.MPAngle.Max',  extract: b => arrMax(b.Ori?.MPAngle) },
        ],
    },
    // ── bone.Ori.MPAmp ──────────────────────────────────────────────────────
    {
        group: 'Ori.MPAmp',
        hint: 'bone.Ori.MPAmp — number[] MPAngle − MPMean per frame (rad)',
        fields: [
            { id: 'mpamp_rms', label: 'RMS', header: 'Ori.MPAmp.RMS', extract: b => arrRMS(b.Ori?.MPAmp) },
            { id: 'mpamp_std', label: 'Std', header: 'Ori.MPAmp.Std', extract: b => arrStd(b.Ori?.MPAmp) },
            { id: 'mpamp_min', label: 'Min', header: 'Ori.MPAmp.Min', extract: b => arrMin(b.Ori?.MPAmp) },
            { id: 'mpamp_max', label: 'Max', header: 'Ori.MPAmp.Max', extract: b => arrMax(b.Ori?.MPAmp) },
        ],
    },
    // ── bone.Ori.MPProLen ───────────────────────────────────────────────────
    {
        group: 'Ori.MPProLen',
        hint: 'bone.Ori.MPProLen — number[] 2D projection length per frame',
        fields: [
            { id: 'mppl_mean', label: 'Mean', header: 'Ori.MPProLen.Mean', extract: b => arrMean(b.Ori?.MPProLen) },
            { id: 'mppl_std',  label: 'Std',  header: 'Ori.MPProLen.Std',  extract: b => arrStd(b.Ori?.MPProLen) },
            { id: 'mppl_min',  label: 'Min',  header: 'Ori.MPProLen.Min',  extract: b => arrMin(b.Ori?.MPProLen) },
            { id: 'mppl_max',  label: 'Max',  header: 'Ori.MPProLen.Max',  extract: b => arrMax(b.Ori?.MPProLen) },
        ],
    },
    // ── bone.Ori.V3Loc ──────────────────────────────────────────────────────
    {
        group: 'Ori.V3Loc',
        hint: 'bone.Ori.V3Loc — number[] V3 axis location per frame',
        fields: [
            { id: 'v3loc_mean', label: 'Mean', header: 'Ori.V3Loc.Mean', extract: b => arrMean(b.Ori?.V3Loc) },
            { id: 'v3loc_std',  label: 'Std',  header: 'Ori.V3Loc.Std',  extract: b => arrStd(b.Ori?.V3Loc) },
            { id: 'v3loc_min',  label: 'Min',  header: 'Ori.V3Loc.Min',  extract: b => arrMin(b.Ori?.V3Loc) },
            { id: 'v3loc_max',  label: 'Max',  header: 'Ori.V3Loc.Max',  extract: b => arrMax(b.Ori?.V3Loc) },
        ],
    },
    // ── bone.Ori.V3Amp ──────────────────────────────────────────────────────
    {
        group: 'Ori.V3Amp',
        hint: 'bone.Ori.V3Amp — number[] V3Loc − V3Mean per frame',
        fields: [
            { id: 'v3amp_rms', label: 'RMS', header: 'Ori.V3Amp.RMS', extract: b => arrRMS(b.Ori?.V3Amp) },
            { id: 'v3amp_std', label: 'Std', header: 'Ori.V3Amp.Std', extract: b => arrStd(b.Ori?.V3Amp) },
            { id: 'v3amp_min', label: 'Min', header: 'Ori.V3Amp.Min', extract: b => arrMin(b.Ori?.V3Amp) },
            { id: 'v3amp_max', label: 'Max', header: 'Ori.V3Amp.Max', extract: b => arrMax(b.Ori?.V3Amp) },
        ],
    },
    // ── bone.Ori.MPFFTResult ────────────────────────────────────────────────
    {
        group: 'Ori.MPFFTResult',
        hint: 'bone.Ori.MPFFTResult — FFT of MPAmp (sample_freq = 30 Hz)',
        fields: [
            { id: 'fft_maxidx',  label: 'maxFreqIdx',          header: 'Ori.MPFFTResult.maxFreqIdx',    extract: b => b.Ori?.MPFFTResult?.maxFreqIdx },
            { id: 'fft_maxamp',  label: 'maxFreqAmp',          header: 'Ori.MPFFTResult.maxFreqAmp',    extract: b => b.Ori?.MPFFTResult?.maxFreqAmp },
            { id: 'fft_orilen',  label: 'oriTrackLength',      header: 'Ori.MPFFTResult.oriTrackLength', extract: b => b.Ori?.MPFFTResult?.oriTrackLength },
            { id: 'fft_peakhz',  label: 'f[maxFreqIdx] (Hz)', header: 'Ori.MPFFTResult.PeakFreq_Hz',   extract: b => { const r = b.Ori?.MPFFTResult; return (r?.f && r.maxFreqIdx != null) ? r.f[r.maxFreqIdx] : null; } },
            { id: 'fft_f_mean',  label: 'f: Mean',  header: 'Ori.MPFFTResult.f.Mean',     extract: b => arrMean(b.Ori?.MPFFTResult?.f) },
            { id: 'fft_f_max',   label: 'f: Max',   header: 'Ori.MPFFTResult.f.Max',      extract: b => arrMax(b.Ori?.MPFFTResult?.f) },
            { id: 'fft_amp_mean',label: 'amp: Mean',header: 'Ori.MPFFTResult.amp.Mean',   extract: b => arrMean(b.Ori?.MPFFTResult?.amp) },
            { id: 'fft_amp_max', label: 'amp: Max', header: 'Ori.MPFFTResult.amp.Max',    extract: b => arrMax(b.Ori?.MPFFTResult?.amp) },
            { id: 'fft_ang_mean',label: 'angle: Mean',header: 'Ori.MPFFTResult.angle.Mean',extract: b => arrMean(b.Ori?.MPFFTResult?.angle) },
            { id: 'fft_ang_std', label: 'angle: Std', header: 'Ori.MPFFTResult.angle.Std', extract: b => arrStd(b.Ori?.MPFFTResult?.angle) },
        ],
    },
];

// Batch Statistics exposes only the manuscript-facing properties below.
const FIELD_GROUPS = [
    {
        group: 'Basic Properties',
        hint: 'Basic skeletal properties',
        fields: [
            {
                id: 'bone_length_average',
                label: 'Bone Length (Average)',
                header: 'Bone Length (Average)',
                extract: b => arrMean(b.Ori?.keyBoneLen),
            },
        ],
    },
    {
        group: 'Motion Decomposition',
        hint: 'PCA decomposition, MP Angle, and V3 statistics',
        fields: [
            {
                id: 'pca_mu',
                section: '(1) PCA Results',
                label: '(1.1) Mean Bone Vector (mu)',
                columns: [
                    { header: 'Mean Bone Vector (mu) X', extract: b => b.PCAResult?.mu?.[0] },
                    { header: 'Mean Bone Vector (mu) Y', extract: b => b.PCAResult?.mu?.[1] },
                    { header: 'Mean Bone Vector (mu) Z', extract: b => b.PCAResult?.mu?.[2] },
                ],
            },
            {
                id: 'pca_main_variance',
                section: '(1) PCA Results',
                label: '(1.2) Explained Variance Ratio (Main Motion Variance, M)',
                header: 'Explained Variance Ratio (Main Motion Variance, M)',
                extract: b => b.PCAResult?.explained?.[1],
            },
            {
                id: 'pca_secondary_variance',
                section: '(1) PCA Results',
                label: '(1.3) Explained Variance Ratio (Secondary Motion Variance, S)',
                header: 'Explained Variance Ratio (Secondary Motion Variance, S)',
                extract: b => b.PCAResult?.explained?.[2],
            },
            {
                id: 'pca_ms_ratio',
                section: '(1) PCA Results',
                label: '(1.4) M/S',
                header: 'M/S',
                extract: b => b.Ori?.V2Ratio,
            },
            {
                id: 'mp_angle_mean',
                section: '(2) MP Angle (degrees)',
                label: '(2.1) Mean',
                header: 'MP Angle Mean (deg)',
                extract: b => {
                    const value = arrMean(b.Ori?.MPAngle);
                    return value == null ? null : value * RAD_TO_DEG;
                },
            },
            {
                id: 'mp_angle_min',
                section: '(2) MP Angle (degrees)',
                label: '(2.2) Min',
                header: 'MP Angle Min (deg)',
                extract: b => {
                    const value = arrMin(b.Ori?.MPAngle);
                    return value == null ? null : value * RAD_TO_DEG;
                },
            },
            {
                id: 'mp_angle_max',
                section: '(2) MP Angle (degrees)',
                label: '(2.3) Max',
                header: 'MP Angle Max (deg)',
                extract: b => {
                    const value = arrMax(b.Ori?.MPAngle);
                    return value == null ? null : value * RAD_TO_DEG;
                },
            },
            {
                id: 'mp_angle_mean_half_peak_to_peak',
                section: '(2) MP Angle (degrees)',
                label: '(2.4) Mean-half Peak-to-peak',
                header: 'MP Angle Mean-half Peak-to-peak (deg)',
                extract: b => Number.isFinite(b.Ori?.MPAmpRangeDeg)
                    ? b.Ori.MPAmpRangeDeg / 2
                    : null,
            },
            {
                id: 'v3_mean',
                section: '(3) V3',
                label: '(3.1) Mean',
                header: 'V3 Mean',
                extract: b => b.Ori?.V3Mean,
            },
            {
                id: 'v3_min',
                section: '(3) V3',
                label: '(3.2) Min',
                header: 'V3 Min',
                extract: b => arrMin(b.Ori?.V3Loc),
            },
            {
                id: 'v3_max',
                section: '(3) V3',
                label: '(3.3) Max',
                header: 'V3 Max',
                extract: b => arrMax(b.Ori?.V3Loc),
            },
        ],
    },
];

function fieldColumns(field) {
    return field.columns || [{ header: field.header || field.label, extract: field.extract }];
}

// ---- CSV helpers ----
function csvCell(v) {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
}
function buildCSV(columns, rows) {
    const header = ['File No.', 'Filename', 'Bone', ...columns.map(column => column.header)];
    return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
}
function downloadCSV(content, name) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.csv') ? name : name + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

// ---- Style helpers (workspace style) ----
function ws(el, css) { el.style.cssText += css; }

function workspaceBtn(el, accent = false) {
    const base = accent
        ? 'border: 1px solid rgba(141,212,255,0.5); background: rgba(141,212,255,0.1); color: #8dd4ff;'
        : 'border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #f5f6ff;';
    ws(el, `padding: 6px 14px; border-radius: 6px; ${base}
        cursor: pointer; font-size: 13px; font-weight: 500;
        transition: background 0.15s ease, border-color 0.15s ease; white-space: nowrap;`);
    el.addEventListener('mouseenter', () => {
        if (el.disabled) return;
        el.style.background = accent ? 'rgba(141,212,255,0.2)' : 'rgba(255,255,255,0.18)';
        el.style.borderColor = accent ? 'rgba(141,212,255,0.8)' : 'rgba(255,255,255,0.35)';
    });
    el.addEventListener('mouseleave', () => {
        if (el.disabled) return;
        el.style.background = accent ? 'rgba(141,212,255,0.1)' : 'rgba(255,255,255,0.08)';
        el.style.borderColor = accent ? 'rgba(141,212,255,0.5)' : 'rgba(255,255,255,0.2)';
    });
}

function secTitle(text) {
    const el = document.createElement('div');
    el.innerText = text;
    ws(el, 'font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.38); text-transform: uppercase; letter-spacing: 0.6px;');
    return el;
}

function setDisabled(btn, disabled) {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.45' : '1';
    btn.style.cursor = disabled ? 'default' : 'pointer';
}

// ---- Main ----
export function createBatchStatsUI({ files, sceneManager, onBack }) {
    let running = false;
    let cancelled = false;
    let boneListReady = false;
    let csvResult = null; // { columns, rows }

    const boneCheckboxes = new Map(); // boneName → <input>
    const fieldCheckboxes = new Map(); // fieldId → <input>

    // ---- Root overlay ----
    const overlay = document.createElement('div');
    ws(overlay, `position: fixed; inset: 0; z-index: 11000;
        background: #0f1117; display: flex; flex-direction: column;
        font-family: 'Segoe UI', sans-serif; color: #f5f5f5; font-size: 13px;`);

    // ---- Header ----
    const header = document.createElement('div');
    ws(header, `display: flex; align-items: center; gap: 12px; padding: 10px 20px;
        background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;`);

    const backBtn = document.createElement('button');
    backBtn.type = 'button'; backBtn.innerText = '← Back';
    workspaceBtn(backBtn);
    backBtn.addEventListener('click', () => { if (!running) { destroy(); onBack?.(); } });

    const titleEl = document.createElement('div');
    titleEl.innerText = 'Batch Statistics';
    ws(titleEl, 'font-size: 15px; font-weight: 600;');

    const fileCountEl = document.createElement('div');
    fileCountEl.innerText = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    ws(fileCountEl, 'font-size: 12px; color: #8dd4ff;');

    const headerStatus = document.createElement('div');
    ws(headerStatus, 'flex: 1; font-size: 11px; color: rgba(255,255,255,0.35); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');

    header.appendChild(backBtn);
    header.appendChild(titleEl);
    header.appendChild(fileCountEl);
    header.appendChild(headerStatus);

    // ---- Main area ----
    const mainArea = document.createElement('div');
    ws(mainArea, 'display: flex; flex: 1; min-height: 0;');

    // ======== Left: Bone list ========
    const leftPanel = document.createElement('div');
    ws(leftPanel, `width: 260px; flex-shrink: 0;
        background: rgba(6,10,18,0.75); border-right: 1px solid rgba(255,255,255,0.08);
        display: flex; flex-direction: column; overflow: hidden;`);

    const leftTop = document.createElement('div');
    ws(leftTop, 'padding: 12px 14px 8px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;');
    leftTop.appendChild(secTitle('Bones'));

    const boneBtnRow = document.createElement('div');
    ws(boneBtnRow, 'display: flex; gap: 6px;');
    const boneAllBtn = document.createElement('button');
    boneAllBtn.type = 'button'; boneAllBtn.innerText = 'All';
    workspaceBtn(boneAllBtn);
    ws(boneAllBtn, 'flex: 1; font-size: 11px; padding: 4px 6px;');
    const boneNoneBtn = document.createElement('button');
    boneNoneBtn.type = 'button'; boneNoneBtn.innerText = 'None';
    workspaceBtn(boneNoneBtn);
    ws(boneNoneBtn, 'flex: 1; font-size: 11px; padding: 4px 6px;');
    boneAllBtn.addEventListener('click',  () => boneCheckboxes.forEach(cb => { cb.checked = true;  }));
    boneNoneBtn.addEventListener('click', () => boneCheckboxes.forEach(cb => { cb.checked = false; }));
    boneBtnRow.appendChild(boneAllBtn);
    boneBtnRow.appendChild(boneNoneBtn);
    leftTop.appendChild(boneBtnRow);

    const boneListEl = document.createElement('div');
    ws(boneListEl, `flex: 1; overflow-y: auto; padding: 4px 14px 14px;
        scrollbar-width: thin; scrollbar-color: rgba(141,212,255,0.3) transparent;
        display: flex; flex-direction: column; gap: 1px;`);

    const boneLoadingEl = document.createElement('div');
    boneLoadingEl.innerText = 'Loading bone list…';
    ws(boneLoadingEl, 'font-size: 12px; color: rgba(255,255,255,0.35); padding-top: 6px;');
    boneListEl.appendChild(boneLoadingEl);

    leftPanel.appendChild(leftTop);
    leftPanel.appendChild(boneListEl);

    // ======== Right: Field groups ========
    const rightPanel = document.createElement('div');
    ws(rightPanel, 'flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;');

    const rightTop = document.createElement('div');
    ws(rightTop, 'padding: 12px 20px 8px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;');
    rightTop.appendChild(secTitle('Fields'));

    const fieldBtnRow = document.createElement('div');
    ws(fieldBtnRow, 'display: flex; gap: 6px; margin-left: auto;');
    const fieldAllBtn = document.createElement('button');
    fieldAllBtn.type = 'button'; fieldAllBtn.innerText = 'Select All';
    workspaceBtn(fieldAllBtn);
    ws(fieldAllBtn, 'font-size: 11px; padding: 4px 10px;');
    const fieldNoneBtn = document.createElement('button');
    fieldNoneBtn.type = 'button'; fieldNoneBtn.innerText = 'Deselect All';
    workspaceBtn(fieldNoneBtn);
    ws(fieldNoneBtn, 'font-size: 11px; padding: 4px 10px;');
    fieldAllBtn.addEventListener('click',  () => fieldCheckboxes.forEach(cb => { cb.checked = true;  }));
    fieldNoneBtn.addEventListener('click', () => fieldCheckboxes.forEach(cb => { cb.checked = false; }));
    fieldBtnRow.appendChild(fieldAllBtn);
    fieldBtnRow.appendChild(fieldNoneBtn);
    rightTop.appendChild(fieldBtnRow);

    const fieldScroll = document.createElement('div');
    ws(fieldScroll, `flex: 1; overflow-y: auto; padding: 8px 20px 14px;
        scrollbar-width: thin; scrollbar-color: rgba(141,212,255,0.3) transparent;
        display: flex; flex-wrap: wrap; gap: 20px 40px; align-content: flex-start;`);

    // Render each group
    for (const grp of FIELD_GROUPS) {
        const grpEl = document.createElement('div');
        ws(grpEl, 'display: flex; flex-direction: column; gap: 3px; min-width: 190px;');

        // Group header with "select all" checkbox
        const grpHdr = document.createElement('div');
        ws(grpHdr, 'display: flex; align-items: center; gap: 7px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.07); margin-bottom: 2px;');
        const grpCb = document.createElement('input');
        grpCb.type = 'checkbox';
        ws(grpCb, 'accent-color: #6f95ff; width: 13px; height: 13px; cursor: pointer; flex-shrink: 0;');
        const grpLabel = document.createElement('span');
        grpLabel.innerText = grp.group;
        if (grp.hint) grpLabel.title = grp.hint;
        ws(grpLabel, 'font-size: 11px; font-weight: 700; color: rgba(141,212,255,0.8); text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;');
        grpHdr.appendChild(grpCb);
        grpHdr.appendChild(grpLabel);
        grpEl.appendChild(grpHdr);

        const groupCbs = [];
        function syncGrpCb() {
            const n = groupCbs.filter(c => c.checked).length;
            grpCb.indeterminate = n > 0 && n < groupCbs.length;
            grpCb.checked = n === groupCbs.length;
        }

        let currentSection = null;
        for (const field of grp.fields) {
            if (field.section && field.section !== currentSection) {
                currentSection = field.section;
                const sectionLabel = document.createElement('div');
                sectionLabel.innerText = field.section;
                ws(sectionLabel, 'font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.55); padding: 7px 0 2px;');
                grpEl.appendChild(sectionLabel);
            }
            const row = document.createElement('label');
            ws(row, 'display: flex; align-items: center; gap: 7px; cursor: pointer; padding: 2px 0; border-radius: 4px;');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            ws(cb, 'accent-color: #6f95ff; width: 13px; height: 13px; cursor: pointer; flex-shrink: 0;');
            const lbl = document.createElement('span');
            lbl.innerText = field.label;
            ws(lbl, 'font-size: 12px; color: #d2daf1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');
            row.appendChild(cb); row.appendChild(lbl);
            cb.addEventListener('change', syncGrpCb);
            fieldCheckboxes.set(field.id, cb);
            groupCbs.push(cb);
            grpEl.appendChild(row);
        }

        grpCb.addEventListener('change', () => groupCbs.forEach(cb => { cb.checked = grpCb.checked; }));
        grpLabel.addEventListener('click', () => { grpCb.checked = !grpCb.checked; grpCb.dispatchEvent(new Event('change')); });

        fieldScroll.appendChild(grpEl);
    }

    rightPanel.appendChild(rightTop);
    rightPanel.appendChild(fieldScroll);

    mainArea.appendChild(leftPanel);
    mainArea.appendChild(rightPanel);

    // ======== Bottom bar ========
    const bottomBar = document.createElement('div');
    ws(bottomBar, `flex-shrink: 0; padding: 10px 20px 14px;
        background: rgba(0,0,0,0.45); border-top: 1px solid rgba(255,255,255,0.08);
        display: flex; flex-direction: column; gap: 8px;`);

    // Progress
    const progressWrap = document.createElement('div');
    ws(progressWrap, 'display: none; flex-direction: column; gap: 4px;');
    const progressOuter = document.createElement('div');
    ws(progressOuter, 'height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;');
    const progressInner = document.createElement('div');
    ws(progressInner, 'height: 100%; background: #6f95ff; border-radius: 2px; width: 0%; transition: width 0.25s ease;');
    progressOuter.appendChild(progressInner);
    const progressText = document.createElement('div');
    ws(progressText, 'font-size: 11px; color: #bcc5df;');
    progressWrap.appendChild(progressOuter);
    progressWrap.appendChild(progressText);

    // Controls
    const ctrlRow = document.createElement('div');
    ws(ctrlRow, 'display: flex; align-items: center; gap: 10px; flex-wrap: wrap;');

    const csvLabel = document.createElement('span');
    csvLabel.innerText = 'CSV filename:';
    ws(csvLabel, 'font-size: 12px; color: rgba(255,255,255,0.45); white-space: nowrap;');

    const csvInput = document.createElement('input');
    csvInput.type = 'text'; csvInput.value = 'batch_statistics';
    ws(csvInput, `padding: 5px 8px; border-radius: 6px; width: 180px;
        border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2);
        color: #fff; font-size: 13px; font-family: inherit;`);

    const runBtn = document.createElement('button');
    runBtn.type = 'button'; runBtn.innerText = 'Run Analysis';
    workspaceBtn(runBtn, true);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.innerText = 'Cancel';
    workspaceBtn(cancelBtn);
    cancelBtn.style.display = 'none';
    cancelBtn.addEventListener('click', () => { cancelled = true; });

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button'; downloadBtn.innerText = '⬇ Download CSV';
    workspaceBtn(downloadBtn);
    downloadBtn.style.display = 'none';

    ctrlRow.appendChild(csvLabel);
    ctrlRow.appendChild(csvInput);
    ctrlRow.appendChild(runBtn);
    ctrlRow.appendChild(cancelBtn);
    ctrlRow.appendChild(downloadBtn);

    bottomBar.appendChild(progressWrap);
    bottomBar.appendChild(ctrlRow);

    overlay.appendChild(header);
    overlay.appendChild(mainArea);
    overlay.appendChild(bottomBar);
    document.body.appendChild(overlay);

    // ======== Headless SkeletalMotion (no scene) ========
    const sm = new SkeletalMotion(sceneManager);

    async function loadBoneList() {
        let foundBones = [];
        let foundFile = null;
        for (const file of files) {
            try {
                await sm.loadSkeletalMotionFromFile(file);
                const bd = getBoneInfo(sm.originClip?.tracks || [], sm.AllBoneInfo, sm.BoneInfo || []);
                if (bd.length > 0) { foundBones = bd; foundFile = file; break; }
            } catch (e) { /* try next file */ }
        }
        sm.resetState();

        boneListEl.innerHTML = '';
        if (foundBones.length === 0) {
            const hint = document.createElement('div');
            hint.innerText = 'No bones found in the file queue.';
            ws(hint, 'font-size: 12px; color: rgba(255,255,255,0.35); padding-top: 6px;');
            boneListEl.appendChild(hint);
        } else {
            headerStatus.innerText = `Bone list from: ${foundFile?.name ?? ''}`;
            for (const bone of foundBones) {
                const row = document.createElement('label');
                ws(row, 'display: flex; align-items: center; gap: 7px; cursor: pointer; padding: 3px 2px; border-radius: 4px;');
                const cb = document.createElement('input');
                cb.type = 'checkbox'; cb.checked = true;
                ws(cb, 'accent-color: #6f95ff; width: 13px; height: 13px; cursor: pointer; flex-shrink: 0;');
                const lbl = document.createElement('span');
                lbl.innerText = bone.name;
                lbl.title = bone.name;
                ws(lbl, 'font-size: 12px; color: #d2daf1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');
                row.appendChild(cb); row.appendChild(lbl);
                boneCheckboxes.set(bone.name, cb);
                boneListEl.appendChild(row);
            }
        }
        boneListReady = true;
        setDisabled(runBtn, false);
    }

    setDisabled(runBtn, true); // disabled until bone list ready
    loadBoneList().catch(err => {
        boneListEl.innerHTML = '';
        const hint = document.createElement('div');
        hint.innerText = `Error loading bones: ${err?.message || err}`;
        ws(hint, 'font-size: 12px; color: #ff6b6b; padding-top: 6px;');
        boneListEl.appendChild(hint);
        boneListReady = true;
        setDisabled(runBtn, false);
    });

    // ======== Run Analysis ========
    runBtn.addEventListener('click', async () => {
        if (running || !boneListReady) return;

        const selectedBones = new Set(
            [...boneCheckboxes.entries()].filter(([, cb]) => cb.checked).map(([name]) => name)
        );
        const selectedFields = FIELD_GROUPS.flatMap(g => g.fields)
            .filter(f => fieldCheckboxes.get(f.id)?.checked);
        const selectedColumns = selectedFields.flatMap(fieldColumns);

        if (selectedBones.size === 0) { alert('Select at least one bone.'); return; }
        if (selectedFields.length === 0) { alert('Select at least one field.'); return; }

        running = true; cancelled = false; csvResult = null;
        downloadBtn.style.display = 'none';
        progressInner.style.width = '0%';
        progressWrap.style.display = 'flex';
        cancelBtn.style.display = '';
        setDisabled(runBtn, true);
        setDisabled(backBtn, true);

        const rows = [];

        for (let i = 0; i < files.length && !cancelled; i++) {
            const pct = Math.round((i / files.length) * 100);
            progressInner.style.width = pct + '%';
            progressText.innerText = `Processing ${i + 1} / ${files.length}: ${files[i].name}`;

            try {
                await sm.loadSkeletalMotionFromFile(files[i]);
                const boneData = getBoneInfo(
                    sm.originClip?.tracks || [], sm.AllBoneInfo, sm.BoneInfo || []
                );

                for (const bone of boneData) {
                    if (!selectedBones.has(bone.name)) continue;
                    const row = [i + 1, files[i].name, bone.name];
                    for (const column of selectedColumns) {
                        const val = column.extract(bone);
                        if (val == null) {
                            row.push('');
                        } else {
                            const n = Number(val);
                            row.push(Number.isFinite(n) ? String(n) : String(val));
                        }
                    }
                    rows.push(row);
                }
            } catch (err) {
                console.error(`[BatchStats] Error on ${files[i].name}:`, err);
                rows.push([i + 1, files[i].name, 'ERROR', ...selectedColumns.map(() => '')]);
            }
        }

        sm.resetState();
        progressInner.style.width = '100%';
        if (cancelled) {
            progressText.innerText = `Cancelled — ${rows.length} row(s) collected from ${files.length} file(s).`;
        } else {
            progressText.innerText = `Done — ${rows.length} row(s) from ${files.length} file(s).`;
            if (rows.length > 0) {
                csvResult = { columns: selectedColumns, rows };
                downloadBtn.style.display = '';
            }
        }

        running = false;
        cancelBtn.style.display = 'none';
        setDisabled(runBtn, false);
        setDisabled(backBtn, false);
    });

    // ======== Download CSV ========
    downloadBtn.addEventListener('click', () => {
        if (!csvResult) return;
        const csv = buildCSV(csvResult.columns, csvResult.rows);
        downloadCSV(csv, csvInput.value.trim() || 'batch_statistics');
    });

    // ======== Cleanup ========
    function destroy() {
        cancelled = true;
        sm.resetState();
        overlay.remove();
    }

    return { destroy };
}
