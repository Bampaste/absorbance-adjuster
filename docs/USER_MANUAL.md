# User Manual

## Purpose

Absorbance Adjuster helps during sample absorbance adjustment. It calculates how much solvent or raw suspension may be needed, keeps records for multiple samples, and generates final experiment-note text.

## Main Fields

`Sample No.`

Identifier for the current sample. Use this when adjusting several samples at the same time, such as `S1`, `S2`, or `A-03`.

`Solvent`

The solvent added to dilute the sample, such as `water`.

`Sample volume`

The starting sample or raw suspension volume.

`Solvent already present`

The solvent already mixed with the sample before adjustment.

`Excitation wavelength`

The wavelength used for the absorbance-related measurement note.

`Current absorbance`

The measured absorbance before the current adjustment calculation.

`Target absorbance`

The desired absorbance.

`Current volume in cuvette`

The actual current total volume in the cuvette or sample mixture.

`Raw suspension adding volume`

The amount of raw suspension currently present in the mixture. This is used when the sample is too dilute and raw suspension needs to be added.

## Buttons

`Calculate`

Calculates the suggested amount of solvent or raw suspension to add.

`Add into sample`

Use this only when you actually add the calculated volume. It updates the current volume fields.

`Log step`

Records the current calculation and the actual volume state shown in the input boxes.

Important: if you manually add a rounded volume, type the real updated volume before pressing `Log step`.

`Clear current sample`

Deletes only the records for the sample currently typed in `Sample No.`.

`Clear all`

Deletes records for every sample.

`Generate`

Creates final conduction descriptions for all logged samples.

`Copy description`

Copies the generated description text.

## Recommended Workflow

1. Type a sample number, for example `S1`.
2. Enter the starting sample volume and solvent already present.
3. Enter current absorbance and target absorbance.
4. Press `Calculate`.
5. If you add exactly the calculated amount, press `Add into sample`.
6. If you add a rounded or different amount, manually update:
   - `Current volume in cuvette`
   - `Raw suspension adding volume`, if raw suspension was added
7. Press `Log step`.
8. Repeat calculation and logging as needed.
9. Press `Generate`.
10. Press `Copy description` and paste into your experiment note.

## Multiple Samples

To work on multiple samples:

1. Type `S1`, calculate and log steps.
2. Change `Sample No.` to `S2`, calculate and log steps.
3. Change back to `S1` if needed and continue.

The operation record and final description keep each sample separated.

## Final Description Meaning

The final description reports the latest logged real state for each sample:

```text
Sample S1: 20 uL sample + 400 uL water with final Abs 0.512 at 365 nm excitation wavelength.
```

The app uses the numbers visible in the input boxes when `Log step` is pressed. This means manual rounding is preserved correctly.

## Calculation Assumption

The calculation assumes absorbance is linear with concentration. Check whether this assumption is suitable for your experimental system.
