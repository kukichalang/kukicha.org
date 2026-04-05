(function () {
    const EXAMPLES = {
        hello: `func main()
    name := "world"
    print("Hello, {name}!")`,

        pipes: `import "stdlib/slice"

func main()
    users := list of string{"alice", "bob", "charlie"}
    active := users
        |> slice.Filter(u => u isnt "bob")
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

        enums: `enum Color
    Red
    Green
    Blue

enum Planet
    Mercury = 1
    Venus = 2
    Earth = 3

func main()
    c := Color.Green
    if c equals Color.Green
        print("Go!")

    p := Planet.Earth
    print("Earth is planet #{p}")`,

        ifexpr: `func main()
    score := 85
    grade := if score >= 90 then "A" else if score >= 80 then "B" else "C"
    print("Score: {score}, Grade: {grade}")

    for i from 1 to 16
        line := if i % 15 == 0 then "FizzBuzz"
            else if i % 3 == 0 then "Fizz"
            else if i % 5 == 0 then "Buzz"
            else "{i}"
        print(line)`,

        typeswitch: `interface Shape
    Area() float64

type Circle
    radius float64

func Area on c Circle float64
    return 3.14159 * c.radius * c.radius

type Rect
    w float64
    h float64

func Area on r Rect float64
    return r.w * r.h

func describe(s Shape) string
    return s |> switch as v
        when Circle
            return "circle r={v.radius} area={v.Area()}"
        when Rect
            return "{v.w}x{v.h} rect area={v.Area()}"
        otherwise
            return "unknown"

func main()
    shapes := list of Shape{
        Circle{radius: 5.0},
        Rect{w: 3.0, h: 4.0},
    }
    for s in shapes
        print(describe(s))`,

        channels: `import "time"

func main()
    ch := make(channel of string)
    done := make(channel of bool)

    go
        time.Sleep(100 * time.Millisecond)
        send "hello from goroutine" to ch

    select
        when msg := receive from ch
            print("received: {msg}")
        when receive from done
            print("done signal")
        otherwise
            print("no one ready yet")

    # Wait for the goroutine
    msg := receive from ch
    print("got: {msg}")`,

        operators: `import "stdlib/slice"

func main()
    items := list of string{"apple", "banana", "cherry", "date"}

    has := slice.Contains(items, "cherry")
    print("has cherry: {has}")

    fruits := items
        |> slice.Filter(f => len(f) > 5)
        |> slice.Map(f => "{f}!")
    for f in fruits
        print(f)

    x := 10
    ok := x > 5 and x < 20 and not (x equals 15)
    print("x={x} in range and not 15: {ok}")`,
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
                    var btn = runEl();
                    if (btn) btn.disabled = false;
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

    function runEl()       { return document.getElementById('playground-run'); }
    function outputSecEl() { return document.getElementById('playground-output-section'); }
    function runOutputEl() { return document.getElementById('playground-run-output'); }

    var ALLOWED_IMPORTS = [
        'stdlib/slice', 'stdlib/sort', 'stdlib/maps', 'stdlib/string',
        'stdlib/cast', 'stdlib/parse', 'stdlib/json', 'stdlib/encoding',
        'stdlib/regex', 'stdlib/iterator', 'stdlib/container', 'stdlib/errors',
        'stdlib/semver', 'stdlib/validate', 'stdlib/concurrent', 'stdlib/ctx',
        'stdlib/datetime', 'stdlib/random', 'stdlib/table', 'stdlib/html',
        'stdlib/retry', 'stdlib/must', 'stdlib/crypto', 'stdlib/template',
        'fmt', 'math', 'math/rand', 'math/big', 'strings', 'strconv',
        'sort', 'slices', 'maps', 'cmp', 'unicode', 'unicode/utf8',
        'encoding/json', 'encoding/xml', 'encoding/csv', 'encoding/base64',
        'encoding/hex', 'bytes', 'bufio', 'io', 'regexp', 'errors',
        'log', 'time', 'context', 'sync', 'sync/atomic',
    ];

    function formatRunError(msg) {
        var m = msg.match(/^import "(.+?)" is not allowed in the playground$/);
        if (!m) return msg;
        var pkg = m[1];
        var hint = pkg.startsWith('stdlib/')
            ? 'Allowed stdlib packages: ' + ALLOWED_IMPORTS.filter(function (p) { return p.startsWith('stdlib/'); }).join(', ')
            : 'Allowed Go packages: ' + ALLOWED_IMPORTS.filter(function (p) { return !p.startsWith('stdlib/'); }).join(', ');
        return 'import "' + pkg + '" is not available in the playground.\n\n' + hint;
    }

    function doRun() {
        var source = inputEl() ? inputEl().value : '';
        if (!source.trim()) return;

        var btn = runEl();
        if (btn) { btn.disabled = true; btn.textContent = 'Compiling…'; }
        var sec = outputSecEl();
        var out = runOutputEl();
        if (sec) sec.hidden = false;
        if (out) { out.textContent = ''; out.className = 'playground-run-output'; }

        fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Source: source }),
        })
        .then(function (resp) {
            if (resp.status === 429) {
                throw new Error('Rate limit exceeded — please wait a moment');
            }
            if (resp.status === 503) {
                throw new Error('Server busy — try again shortly');
            }
            if (!resp.ok) {
                return resp.text().then(function (t) { throw new Error(t); });
            }
            return resp.json();
        })
        .then(function (data) {
            if (out) {
                if (data.Errors) {
                    out.textContent = formatRunError(data.Errors);
                    out.className = 'playground-run-output error';
                } else {
                    out.textContent = data.Output || '(no output)';
                    out.className = 'playground-run-output';
                }
                if (data.DurationMs !== undefined) {
                    var statusText = 'Completed in ' + data.DurationMs + 'ms';
                    setStatus(statusText, '');
                }
            }
        })
        .catch(function (err) {
            if (out) {
                out.textContent = err.message;
                out.className = 'playground-run-output error';
            }
        })
        .finally(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Run'; }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const dialog  = document.getElementById('playground-dialog');
        const input   = inputEl();
        const example = document.getElementById('playground-example');

        if (!dialog || !input) return;

        // Pre-load the default example.
        input.value = EXAMPLES.hello;

        input.addEventListener('input', scheduleTranspile);

        var runBtn = runEl();
        if (runBtn) runBtn.addEventListener('click', doRun);

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
