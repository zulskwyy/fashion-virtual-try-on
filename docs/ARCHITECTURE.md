# V10 architecture

```text
Webpage / Google Images
        |
        | selected image URL
        v
Browser extension
        |
        v
Try-On site (Vercel)
        |
        | camera snapshot + garment
        v
Vercel Function
        |
        | @gradio/client
        v
Hugging Face Space: yisol/IDM-VTON
        |
        v
Generated try-on image
```

The extension only transports the garment image URL. The browser captures the user's person frame locally. The VTON inference runs remotely. Camera frames are not streamed to the model continuously.
