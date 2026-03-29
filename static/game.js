const go = new Go();
WebAssembly.instantiateStreaming(fetch("/static/wasm/stem-panic.wasm"), go.importObject)
    .then(result => go.run(result.instance));
