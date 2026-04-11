async function main() {
  const urls = [
    "https://huggingface.co/Xenova/jina-clip-v1/resolve/main/config.json",
    "https://huggingface.co/jinaai/jina-clip-v1/resolve/main/config.json",
    "https://huggingface.co/jinaai/jina-clip-v1/resolve/main/onnx/text_model.onnx",
    "https://huggingface.co/jinaai/jina-clip-v1/resolve/main/onnx/vision_model.onnx",
    "https://huggingface.co/jinaai/jina-clip-v1/resolve/main/onnx/text_model_fp16.onnx",
    "https://huggingface.co/jinaai/jina-clip-v1/resolve/main/onnx/vision_model_fp16.onnx",
  ];

  for (const u of urls) {
    try {
      const r = await fetch(u, { method: "HEAD" });
      console.log(r.status, u);
    } catch (e: any) {
      console.log("ERR", u, e.message);
    }
  }
}
main();
