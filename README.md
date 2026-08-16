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

## Tutorial 5: Batch Workflow — Batch Preprocessing

Use **Batch Preprocessing** when you want to inspect, trim, and export several skeletal animations without reopening the import window for every file.

1. Click **Enter MotionMIX**, then click **Batch Workflow** at the bottom of the input-type window.
2. Click **Add Folder** to add all supported animations in one folder, or **Add Files** to select individual files. The batch workflow accepts `.fbx`, `.glb`, and `.gltf` files. You can add more files in several rounds; duplicate files with the same name and size are added only once.
3. Check the **File Queue**. Click `×` beside one file to remove it, or **Clear All** to restart the queue.
4. Click **Batch Preprocessing**. The first animation is loaded into the preview automatically.
5. If the browser supports folder access, click **Select Output Directory** and choose where the exported files should be stored. Otherwise, each file is downloaded through the browser.
6. Use the playback controls to inspect the current animation. Drag **Start** and **End** to keep only the required time interval; leave both controls at their original limits to export the complete animation.
7. Edit **Export Filename** if needed, then click **Export** to save the current animation or **Export & Next** to save it and load the next file. Export each trim before switching files because unexported trim positions are reset when a file is loaded again.
8. Use **Prev** and **Next** to switch between animations. Click **View Log** to check which files have been exported or trimmed. When finished, click **Back to File List**.

Batch Preprocessing exports each result as an animated `.glb` file.

> **Image placeholder 13**
>
> *Figure 13. **Batch Workflow** window with **Add Folder**, **Add Files**, the populated **File Queue**, and the three batch operations.*

> **Image placeholder 14**
>
> *Figure 14. **Batch Preprocessing** workspace showing the animation preview, file navigation, Start/End trim controls, output directory, export filename, and export buttons.*

> **Image placeholder 15**
>
> *Figure 15. **Batch Processing Log** showing exported, unexported, trimmed, and untrimmed files.*

## Tutorial 6: Batch Workflow — Batch Statistics

This example follows the manuscript's validation workflow for the action category **walk**. The source sequences were selected from [AMASS](https://amass.is.tue.mpg.de/) using [BABEL](https://babel.is.tue.mpg.de/) action labels. AMASS and BABEL data are not supplied with MotionMIX: obtain them from their official sites, accept their licenses, and convert the selected sequences to `.fbx`, `.glb`, or `.gltf` before import.

1. Open **Batch Workflow**, then use **Add Folder** or **Add Files** to add the converted walk animations.
2. Check that the files use the same skeleton and bone names. For the manuscript example, the selected units were `L_Hip`, `L_Knee`, `R_Hip`, `R_Knee`, `Spine1`, `Spine2`, `Spine3`, `Neck`, `Head`, `L_Shoulder`, `L_Elbow`, `R_Shoulder`, and `R_Elbow`.
3. Click **Batch Statistics**. Wait while MotionMIX reads the bone list, then use **All**, **None**, and the bone checkboxes to keep only the units required for the analysis.
4. Select the output fields. To reproduce the PCA-decomposition export used for the walk validation, select **(1.2) Explained Variance Ratio (Main Motion Variance, M)**, **(1.3) Explained Variance Ratio (Secondary Motion Variance, S)**, and **(1.4) M/S**. Other available fields cover average bone length, the mean bone vector, MP Angle summaries, and V3 summaries.
5. Enter a **CSV filename**, click **Run Analysis**, and wait for all files to finish. The result contains one row per analyzed file and selected bone, beginning with `File No.`, `Filename`, and `Bone`.
6. Click **Download CSV** to save the completed table. The downloaded statistics are bone-level results; any body-part grouping, left–right averaging, or across-performer summary required by a study is performed in the subsequent analysis code.

> **Image placeholder 16**
>
> *Figure 16. AMASS walk files added to the Batch Workflow queue after conversion to a supported skeletal-animation format.*

> **Image placeholder 17**
>
> *Figure 17. **Batch Statistics** with the walk-analysis bones and the M, S, and M/S PCA statistics selected.*

> **Image placeholder 18**
>
> *Figure 18. Completed Batch Statistics analysis with **Download CSV** enabled, together with the first rows of the exported walk CSV file.*

## Tutorial 7: Batch Workflow — Batch Generation

This example follows the manuscript's demonstration experiment, which started from one standard walking sequence obtained from the [free Xsens motion-capture animation assets](https://www.xsens.com/entertainment/free-xsens-motion-capture-animation-assets). Use the lawfully obtained Xsens FBX file, or a converted GLB copy, as the source animation.

1. Open **Batch Workflow**, add the Xsens walking animation, and click **Batch Generation**.
2. Wait for **Step 1 — File Check**. Expand the file entry if you want to inspect its bones, then click **Continue**. When generating from several files together, use files with the same skeleton and bone names so that every parameter row addresses the intended units.
3. In **Step 2 — Generation Parameters**, click **Select bones**, select all bone units belonging to one target body part, choose **Main Plane Amplitude Scale**, and enter the required scale values as a comma-separated list such as `0, 0.1, 0.2`. One parameter value is applied to every bone selected in that row.
4. Click **Add Parameter Row** when several parameters should vary in the same generation job. **Cartesian Product** generates every combination across rows; **Synchronized Levels** pairs the first value in every row, then the second value in every row, and therefore requires equal-length value lists.
5. In **Step 3 — Export Settings**, select **GLB ZIP** to generate editable animations or **Video ZIP** to generate `.webm` previews. For video, set the frame rate, resolution, scene appearance, repeat count, and one or more camera angles.
6. Click **Generate GLB ZIP** or **Generate Video ZIP** and wait for the ZIP file to download.

To reconstruct the demonstration stimulus continua, run one single-row generation job for each body part so that non-target parts remain unchanged. Select all constituent torso bones for **spine** and both left and right counterparts for each bilateral limb category, following the bone names shown by the imported Xsens file. Use a step of `0.1` and the following inclusive MP Amplitude Scale ranges:

| Target body part | Scale range | Number of levels |
| --- | ---: | ---: |
| Spine | 0–3 | 31 |
| Head | 0–7 | 71 |
| Upper arm | 0–4 | 41 |
| Lower arm | 0–4 | 41 |
| Upper leg | 0–3 | 31 |
| Lower leg | 0–2 | 21 |

Because `1` is the unchanged standard rather than a manipulated stimulus, excluding it from each of the six continua gives 230 manipulated animations in total; retain one separate scale-`1` export when a common standard animation is also required.

> **Image placeholder 19**
>
> *Figure 19. **Batch Generation — File Check** for the Xsens standard walking animation, showing its detected bone list.*

> **Image placeholder 20**
>
> *Figure 20. One demonstration-style parameter row with the target body-part bones selected, **Main Plane Amplitude Scale** selected, and the comma-separated scale levels entered.*

> **Image placeholder 21**
>
> *Figure 21. **Combination Mode** and **Export Settings**, showing both GLB ZIP and Video ZIP output choices.*

## Resetting a change

Click **Initialize** in an individual card to restore that item to its original settings. In General Manipulation, **Initialize** resets the currently selected items.

## Run MotionMIX locally

Users who download this repository can run it with [Node.js](https://nodejs.org/):

```bash
npm install
npx parcel src/index.html
```

Open the local address displayed in the terminal, then click **Enter MotionMIX**.

## Third-party data, assets, and licenses

- **Adobe Mixamo.** Sample files and textures whose names contain `Mixamo` originate from [Adobe Mixamo](https://www.mixamo.com/). Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) permits royalty-free use of its characters and animations in personal, commercial, and non-profit projects.
- **AMASS and BABEL.** These datasets are used as research examples and are not distributed as part of MotionMIX. Their official licenses restrict copying and redistribution; users must register, obtain their own copies, follow the [AMASS license](https://amass.is.tue.mpg.de/license.html) and [BABEL license](https://babel.is.tue.mpg.de/license.html), and cite the corresponding publications.
- **Xsens motion assets.** The demonstration source is credited to the [Xsens free motion-capture animation assets](https://www.xsens.com/entertainment/free-xsens-motion-capture-animation-assets). Xsens-derived FBX files and converted copies are not covered by the MotionMIX code license and remain subject to the terms presented by Xsens when the assets are downloaded. 
- **Unreal Engine and MetaHuman.** MetaHuman characters, Unreal mannequin assets, and media rendered from them remain subject to Epic's [MetaHuman licensing terms](https://www.metahuman.com/license?lang=en-US) and the applicable Unreal Engine terms. Raw character or mannequin assets are not relicensed by MotionMIX.

