# Fashion Virtual Try-On V10.3

A browser-first virtual try-on prototype for clothing. The current milestone uses a live camera preview and an image-based VTON generation step.

## Flow

1. Choose a garment image from a webpage or upload one manually.
2. Start the live camera.
3. Capture a frame.
4. Send the person image + garment image to the Hugging Face `yisol/IDM-VTON` Gradio Space.
5. Show the generated try-on image.

The live camera preview is continuous, but IDM-VTON itself is image-based; it does not generate a new photorealistic garment image on every camera frame.

## Vercel

This project is prepared for Vercel:

- Static frontend: `site/`
- Vercel Function: `api/tryon.js`
- Node.js: `24.x`
- Gradio client: `@gradio/client` `2.7.0`

Vercel automatically exposes files in `/api` as Functions. The project config sets `site` as the static output directory.

## Environment variables

`HF_TOKEN` is optional for the public Space. `HF_SPACE_ID` defaults to `yisol/IDM-VTON`.

## Extension

Load `extension/` as an unpacked extension in a desktop Chromium browser. Update `TRYON_URL` in `extension/background.js` when the deployed Vercel project uses a different domain.

## Limits

This is not 30–60 FPS generative AR. IDM-VTON is an image-to-image virtual try-on pipeline. Public Space availability and quotas can change, and its `CC BY-NC-SA 4.0` license should be reviewed before commercial deployment.


### V10.3 UX
- Camera stays active while changing garments.
- Generated results can be saved via the device download/share flow.
- The browser extension only injects TRY ON controls onto qualifying images and skips the try-on web app itself.
