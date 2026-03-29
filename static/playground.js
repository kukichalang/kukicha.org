(function () {
    const EXAMPLES = {
        hello: `func main()
    name := "world"
    print("Hello, {name}!")`,

        pipes: `import "stdlib/slice"

func main()
    users := list of string{"alice", "bob", "charlie"}
    active := users
        |> slice.Filter(u => u != "bob")
    for user in active
        print(user)`,

        onerr: `func divide(a float64, b float64) (float64, error)
    if b == 0.0
        return 0.0, error "division by zero"
    return a / b, empty

func main()
    result := divide(10.0, 2.0) onerr 0.0
    print("Result: {result}")

    divide(10.0, 0.0) onerr as e
        print("Caught: {e}")`,
    };

    let wasmReady = false;
    let wasmLoading = false;
    let debounceTimer = null;

    function statusEl() { return document.getElementById('playground-status'); }
    function inputEl()  { return document.getElementById('playground-input'); }
    function outputEl() { return document.getElementById('playground-output'); }
    function errorsEl() { return document.getElementById('playground-errors'); }

    function setStatus(msg, cls) {
        const el = statusEl();
        if (!el) return;
        el.textContent = msg;
        el.className = 'playground-status' + (cls ? ' ' + cls : '');
    }

    function loadWasm() {
        if (wasmReady || wasmLoading) return;
        wasmLoading = true;
        setStatus('Loading compiler…', 'loading');

        const go = new Go();
        WebAssembly.instantiateStreaming(
            fetch('/static/wasm/kukicha.wasm'),
            go.importObject
        ).then(function (result) {
            go.run(result.instance);
            // Poll until kukichaTranspile is registered by the WASM module.
            const poll = setInterval(function () {
                if (typeof window.kukichaTranspile === 'function') {
                    clearInterval(poll);
                    wasmReady = true;
                    wasmLoading = false;
                    setStatus('', '');
                    doTranspile();
                }
            }, 50);
        }).catch(function (err) {
            wasmLoading = false;
            setStatus('Failed to load compiler', 'error');
            console.error('kukicha wasm load error:', err);
        });
    }

    function doTranspile() {
        if (!wasmReady) return;
        const source = inputEl() ? inputEl().value : '';
        const result = window.kukichaTranspile(source);
        const out = outputEl();
        const errs = errorsEl();
        if (result.errors && result.errors.length > 0) {
            if (out) out.value = '';
            if (errs) {
                errs.textContent = result.errors.join('\n');
                errs.hidden = false;
            }
        } else {
            if (out) out.value = result.goSource || '';
            if (errs) {
                errs.textContent = '';
                errs.hidden = true;
            }
        }
    }

    function scheduleTranspile() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(doTranspile, 300);
    }

    document.addEventListener('DOMContentLoaded', function () {
        const dialog  = document.getElementById('playground-dialog');
        const input   = inputEl();
        const example = document.getElementById('playground-example');

        if (!dialog || !input) return;

        // Pre-load the default example.
        input.value = EXAMPLES.hello;

        input.addEventListener('input', scheduleTranspile);

        example.addEventListener('change', function () {
            const src = EXAMPLES[example.value];
            if (src !== undefined) {
                input.value = src;
                doTranspile();
            }
        });

        // Lazy-load the WASM the first time the dialog opens.
        dialog.addEventListener('toggle', function (e) {
            if (e.newState === 'open') loadWasm();
        });
    });
}());
