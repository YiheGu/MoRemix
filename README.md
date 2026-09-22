# MoRemix

MoRemix is a browser-based tool for changing recorded human movement without editing animation code. It supports two input types:

- **Skeletal Animation** (`.fbx`, `.glb`, or `.gltf`): a 3D character controlled by connected bones.
- **Point Light Display (PLD)** (`.csv`): moving points that represent the main joints of a body.

The usual workflow is simple: import a motion, select one or more body segments, change a parameter, click **Generate**, preview the result, and export it.

## Before you start

Click **Enter MoRemix** on the bottom of the introduction page, then choose an input type.

> ![MoRemix introduction page](https://github.com/user-attachments/assets/191cf652-f9f7-434b-8d85-844ee76f3e6c)

## Tutorial 1: Import data

### Option A — Skeletal Animation

This tutorial uses the Mixamo **Walking** animation.

1. Choose **Skeletal Animation** and click **Confirm**.
> ![MoRemix introduction page](https://github.com/user-attachments/assets/1558cafe-994c-4574-9d95-06618b5927ac)

2. To obtain a sample motion data from Mixamo, open the [Mixamo walking-animation page](https://www.mixamo.com/#/?page=1&query=walk), choose a walking animation, and download it as an FBX file.
3. To use your downloaded file, click the blue dashed import area and select the file, or drag the file into that area.
4. Click **Confirm** and wait for the workspace to load.

> https://github.com/user-attachments/assets/6b46db0d-c868-455e-ab64-37fc20425bb8

### Option B — Point Light Display (PLD)

The PLD tutorial uses the sample CSV file already included in MoRemix.

1. Choose **Point Light Display** and click **Confirm**.
> ![MoRemix introduction page](https://github.com/user-attachments/assets/1dc920d3-36d7-4f70-bb69-3da56e0b9944)

2. The import window automatically fills in `PLDTestData.csv`. Click **Download sample data** if you want to save a copy locally; downloading is optional because the same file is already selected.
3. Click **Confirm**.
4. The **PLD Parent Binding** window describes how the points are connected. The sample file already has the correct parent IDs, so leave them unchanged and click **Confirm**.
> https://github.com/user-attachments/assets/b209114a-f55a-4dbc-857b-8c61d6aee989

For another PLD file, use a CSV table with the columns `name,frame,x,y,z`. Each row gives the position of one point in one animation frame.




## Tutorial 2: Edit a Skeletal Animation

In this example, **V3 Mean Addition** changes the average elevation of each selected arm along its V3 direction. In this sample, the V3 directions of the left and right upper arms have opposite signs, so opposite values are used to raise both arms.

### Raise the average pose of both upper arms

1. In **Bone List**, click `mixamorig4LeftArm`.
2. In the V3 section of its parameter card, set **Mean Addition (V3/BoneLen)** to `0.3`.
3. Click `mixamorig4RightArm` and set **Mean Addition (V3/BoneLen)** to `-0.3`.
4. Click **Generate** in either updated parameter card.

> https://github.com/user-attachments/assets/181e0d26-a8c0-49c5-ae59-701b3c742c4a

### Change the left and right upper arms together

1. Click **General Manipulation**.
2. Click **Select Bones**, then click **Select None**.
3. Select only `mixamorig4LeftArm` and `mixamorig4RightArm`, then click outside the selection list to close it.
4. Set **Amplitude Scale** to `2` in the General Manipulation card.
5. Click **Generate**. The same value is now applied to both selected upper arms.

> https://github.com/user-attachments/assets/6b31fef1-4d08-4d9d-86f3-495abdf6fa24

The same manipulation workflow can be applied across different actions and skeletal models. The following examples are based on motion-capture data and skeletal models from the [AMASS](https://amass.is.tue.mpg.de/) database.

> https://github.com/user-attachments/assets/86470386-9313-4461-9e4c-67b9a708ee61
> https://github.com/user-attachments/assets/c3a76b35-62e1-4cbe-bd71-973825951c75
> https://github.com/user-attachments/assets/b9617e06-21c6-4f4d-97e0-8364640c9fda

## Tutorial 3: Edit a Point Light Display

PLD editing follows the same logic, but each editable unit is a point together with the segment connecting it to its parent point. In the supplied sample, the two upper-arm segments end at **PLD 14** and **PLD 18**.

### Change one upper arm

1. In the PLD list, click the upper-arm unit you want to change (`PLD 14` or `PLD 18`). Use the highlighted segment in the preview to confirm that you selected the intended side.
2. Set **Amplitude Scale** to `2`.
3. Click **Generate** and preview the result.

> https://github.com/user-attachments/assets/a471e5ed-1ee6-47fa-b1f9-c863bd3b599f

### Change both upper arms together

Editing multiple PLD segments together follows the same General Manipulation workflow as for skeletal animation.

## Tutorial 4: Export data

Click **Export Settings**, select an output type, adjust any settings that appear, and click **Export**.

> https://github.com/user-attachments/assets/c87b2e63-7ec8-4fd1-a0c6-ecf9f95fb6e4

- **Animation File (.glb):** exports the edited skeletal animation for use in compatible 3D software.
- **PLD File (.csv):** exports the edited PLD data or converts the edited skeletal animation into point-position data and exports it as CSV.
- **Video (.webm):** records a preview. Choose **Pane A** for the skeletal view, **Pane B** for the corresponding PLD view, or **Pane A + Pane B** for both. Each selected camera angle produces a video.

> https://github.com/user-attachments/assets/a2d4ded5-8948-424f-a429-840d5895e918

## Tutorial 5: Batch Workflow — Batch Preprocessing

This example imports 10 walking animations and uses **Batch Preprocessing** to inspect them one by one. The same workflow can also be used to trim and export several skeletal animations without reopening the import window for every file.

1. Click **Enter MoRemix**, then click **Batch Workflow** at the bottom of the input-type window.
2. Click **Add Folder** to add the 10 walking animations from one folder, or **Add Files** to select them individually. The batch workflow accepts `.fbx`, `.glb`, and `.gltf` files. You can add more files in several rounds; duplicate files with the same name and size are added only once.
3. Check the **File Queue**. Click `×` beside one file to remove it, or **Clear All** to restart the queue.
4. Click **Batch Preprocessing**. The first animation is loaded into the preview automatically.
5. If the browser supports folder access, click **Select Output Directory** and choose where the exported files should be stored. Otherwise, each file is downloaded through the browser.
6. Use the playback controls to inspect the current animation. Drag **Start** and **End** to keep only the required time interval; leave both controls at their original limits to export the complete animation.
7. Edit **Export Filename** if needed, then click **Export** to save the current animation or **Export & Next** to save it and load the next file. Export each trim before switching files because unexported trim positions are reset when a file is loaded again.
8. Use **Prev** and **Next** to switch between animations. Click **View Log** to check which files have been exported or trimmed. When finished, click **Back to File List**.

Batch Preprocessing exports each result as an animated `.glb` file.

> https://github.com/user-attachments/assets/fc198567-f31c-4bf8-ac42-a47c982eb328


## Tutorial 6: Batch Workflow — Batch Statistics

This example analyzes the shoulder bones in 10 walking animations and reports the ratio of dominant motion variance ($M$) to secondary motion variance ($S$), defined as $M/S$.

1. Open **Batch Workflow**, then use **Add Folder** or **Add Files** to add the 10 walking animations.
2. Check that the files use the same skeleton and bone names. For this example, select the shoulder bones required for the analysis.
3. Click **Batch Statistics**. Wait while MoRemix reads the bone list, then use **All**, **None**, and the bone checkboxes to keep only the units required for the analysis.
4. Select **(1.4) M/S** to export the ratio between the dominant motion variance and secondary motion variance. The component fields **(1.2) Explained Variance Ratio (Main Motion Variance, M)** and **(1.3) Explained Variance Ratio (Secondary Motion Variance, S)** can also be selected when their individual values are needed. Other available fields cover average bone length, the mean bone vector, MP Angle summaries, and V3 summaries.
5. Enter a **CSV filename**, click **Run Analysis**, and wait for all files to finish. The result contains one row per analyzed file and selected bone, beginning with `File No.`, `Filename`, and `Bone`.
6. Click **Download CSV** to save the completed table. The downloaded statistics are bone-level results; any body-part grouping, left–right averaging, or across-performer summary required by a study is performed in the subsequent analysis code.

> https://github.com/user-attachments/assets/e494b119-c2f3-441f-9c9e-5c82dcc86e4c

## Tutorial 7: Batch Workflow — Batch Generation

This example uses one waving animation from the [AMASS](https://amass.is.tue.mpg.de/) database and generates variants by changing its **Frequency Ratio**.

1. Open **Batch Workflow**, add the AMASS waving animation, and click **Batch Generation**.
2. Wait for **Step 1 — File Check**. Expand the file entry if you want to inspect its bones, then click **Continue**. When generating from several files together, use files with the same skeleton and bone names so that every parameter row addresses the intended units.
3. In **Step 2 — Generation Parameters**, click **Select bones**, select the bones to edit, choose **Frequency Ratio**, and enter the required ratio values as a comma-separated list. One parameter value is applied to every bone selected in that row.
4. Click **Add Parameter Row** when several parameters should vary in the same generation job. **Cartesian Product** generates every combination across rows; **Synchronized Levels** pairs the first value in every row, then the second value in every row, and therefore requires equal-length value lists.
5. In **Step 3 — Export Settings**, select **GLB ZIP** to generate editable animations or **Video ZIP** to generate `.webm` previews. For video, set the frame rate, resolution, scene appearance, repeat count, and one or more camera angles.
6. Click **Generate GLB ZIP** or **Generate Video ZIP** and wait for the ZIP file to download.

> https://github.com/user-attachments/assets/8c015258-623f-4f8a-b7ae-7a4b712379df

## Resetting a change

Click **Initialize** in an individual card to restore that item to its original settings. In General Manipulation, **Initialize** resets the currently selected items.

## Run MoRemix locally

Users who download this repository can run it with [Node.js](https://nodejs.org/):

```bash
npm install
npx parcel src/index.html
```

Open the local address displayed in the terminal, then click **Enter MoRemix**.

## Third-party data, assets, and licenses

- **Adobe Mixamo.** Sample files and textures whose names contain `Mixamo` originate from [Adobe Mixamo](https://www.mixamo.com/). Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) permits royalty-free use of its characters and animations in personal, commercial, and non-profit projects.
- **AMASS and BABEL.** These datasets are used as research examples and are not distributed as part of MoRemix. Their official licenses restrict copying and redistribution; users must register, obtain their own copies, follow the [AMASS license](https://amass.is.tue.mpg.de/license.html) and [BABEL license](https://babel.is.tue.mpg.de/license.html), and cite the corresponding publications.
- **Xsens motion assets.** The demonstration source is credited to the [Xsens free motion-capture animation assets](https://www.xsens.com/entertainment/free-xsens-motion-capture-animation-assets). Xsens-derived FBX files and converted copies are not covered by the MoRemix code license and remain subject to the terms presented by Xsens when the assets are downloaded. 
- **Unreal Engine and MetaHuman.** MetaHuman characters, Unreal mannequin assets, and media rendered from them remain subject to Epic's [MetaHuman licensing terms](https://www.metahuman.com/license?lang=en-US) and the applicable Unreal Engine terms. Raw character or mannequin assets are not relicensed by MoRemix.

