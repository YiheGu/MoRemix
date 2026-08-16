# MotionMIX

MotionMIX is a browser-based tool for changing recorded human movement without editing animation code. It supports two input types:

- **Skeletal Animation** (`.fbx`, `.glb`, or `.gltf`): a 3D character controlled by connected bones.
- **Point Light Display (PLD)** (`.csv`): moving points that represent the main joints of a body.

The usual workflow is simple: import a motion, select one or more body segments, change a parameter, click **Generate**, preview the result, and export it.

## Before you start

Click **Enter MotionMIX** on the introduction page, then choose an input type. No knowledge of 3D animation or programming is required for the tutorials below.

> **Image placeholder 1**
>
> *Figure 1. MotionMIX introduction page, showing the **Enter MotionMIX** and **View on GitHub** buttons.*

## Tutorial 1: Import data

### Option A — Skeletal Animation

This tutorial uses the Mixamo **Walking** animation.

1. Choose **Skeletal Animation (.fbx)** and click **Confirm**.
2. The import window already contains the included sample file, `MixamoWalking.fbx`. To obtain another copy from Mixamo, open the [Mixamo walking-animation page](https://www.mixamo.com/#/?page=1&query=walk), choose a walking animation, and download it as an FBX file.
3. To use your downloaded file, click the blue dashed import area and select the file, or drag the file into that area.
4. Click **Confirm** and wait for the workspace to appear.

> **Image placeholder 2**
>
> *Figure 2. Input-type selection with **Skeletal Animation (.fbx)** selected.*

> **Image placeholder 3**
>
> *Figure 3. Skeletal-animation import window, showing the file area, the Mixamo sample link, and the **Confirm** button.*

### Option B — Point Light Display (PLD)

The PLD tutorial uses the sample CSV file already included in MotionMIX.

1. Choose **Point Light Display (.csv)** and click **Confirm**.
2. The import window automatically fills in `PLDTestData.csv`. Click **Download sample data** if you want to save a copy locally; downloading is optional because the same file is already selected.
3. Click **Confirm**.
4. The **PLD Parent Binding** window describes how the points are connected. The sample file already has the correct parent IDs, so leave them unchanged and click **Confirm**.

For another PLD file, use a CSV table with the columns `name,frame,x,y,z`. Each row gives the position of one point in one animation frame.

> **Image placeholder 4**
>
> *Figure 4. PLD import window, showing the preloaded `PLDTestData.csv`, **Download sample data**, and **Confirm**.*

> **Image placeholder 5**
>
> *Figure 5. **PLD Parent Binding** window with the sample file's default parent IDs.*

## Tutorial 2: Edit a Skeletal Animation

In this example, **MP Amplitude Scale** changes how far the selected body segment moves around its average orientation. A value of `1` keeps the original movement; a value of `2` doubles that movement amplitude.

### Change only the left upper arm

1. In **Bone List**, click the left upper-arm bone (`mixamorig4LeftArm` in the supplied Mixamo sample).
2. In its parameter card, find **Amplitude Scale** in the MP section and enter `2`.
3. Click **Generate** in the same card.
4. Use the playback controls to compare the new arm swing with the original motion.

> **Image placeholder 6**
>
> *Figure 6. The left upper-arm bone selected and its individual parameter card set to **MP Amplitude Scale = 2**.*

### Change the left and right upper arms together

1. Click **General Manipulation**.
2. Click **Select Bones**, then click **Select None**.
3. Select only `mixamorig4LeftArm` and `mixamorig4RightArm`, then click outside the selection list to close it.
4. Set **Amplitude Scale** to `2` in the General Manipulation card.
5. Click **Generate**. The same value is now applied to both selected upper arms.

> **Image placeholder 7**
>
> *Figure 7. **General Manipulation** with only the left and right upper-arm bones selected and **MP Amplitude Scale = 2**.*

## Tutorial 3: Edit a Point Light Display

PLD editing follows the same logic, but each editable unit is a point together with the segment connecting it to its parent point. In the supplied sample, the two upper-arm segments end at **PLD 14** and **PLD 18**.

### Change one upper arm

1. In the PLD list, click the upper-arm unit you want to change (`PLD 14` or `PLD 18`). Use the highlighted segment in the preview to confirm that you selected the intended side.
2. Set **Amplitude Scale** to `2`.
3. Click **Generate** and preview the result.

> **Image placeholder 8**
>
> *Figure 8. One upper-arm unit in the sample PLD selected and set to **MP Amplitude Scale = 2**.*

### Change both upper arms together

1. Click **General Manipulation**.
2. Click **Select PLDs**, then click **Select None**.
3. Select **PLD 14** and **PLD 18**, then close the selection list.
4. Set **Amplitude Scale** to `2` and click **Generate**.

> **Image placeholder 9**
>
> *Figure 9. **General Manipulation** with the two sample upper-arm PLDs selected and **MP Amplitude Scale = 2**.*

## Tutorial 4: Export data

Click **Export Settings**, select an output type, adjust any settings that appear, and click **Export**.

### Export options after importing a Skeletal Animation

- **Animation File (.glb):** exports the edited skeletal animation for use in compatible 3D software.
- **PLD File (.csv):** converts the edited skeletal animation into point-position data and exports it as CSV.
- **Video (.webm):** records a preview. Choose **Pane A** for the skeletal view, **Pane B** for the corresponding PLD view, or **Pane A + Pane B** for both. Each selected camera angle produces a video.

> **Image placeholder 10**
>
> *Figure 10. All export choices available after importing a Skeletal Animation: GLB animation, PLD CSV, and WEBM video.*

> **Image placeholder 11**
>
> *Figure 11. Video export settings, including the recording target, camera angle, frame rate, and resolution.*

### Export options after importing PLD data

- **PLD File (.csv):** exports the edited point positions in CSV format.
- **Video (.webm):** records the PLD preview. Select **Pane A**, where the imported PLD is displayed, and choose the desired camera and video settings.

The **Animation File (.glb)** option is intended for an imported Skeletal Animation and does not create a skeletal model from a PLD-only input.

> **Image placeholder 12**
>
> *Figure 12. PLD export workflow, showing PLD CSV export and a Pane A WEBM video export.*

## Resetting a change

Click **Initialize** in an individual card to restore that item to its original settings. In General Manipulation, **Initialize** resets the currently selected items.

## Run MotionMIX locally

Users who download this repository can run it with [Node.js](https://nodejs.org/):

```bash
npm install
npx parcel src/index.html
```

Open the local address displayed in the terminal, then click **Enter MotionMIX**.
