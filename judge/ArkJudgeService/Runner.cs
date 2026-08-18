using System.Text;

namespace ArkJudgeService;

/// <summary>
/// Compiles + runs user code for a language and compares output per test case.
/// </summary>
public static class Runner
{
    // Maps each supported language to a human label (used only for messages).
    private static readonly Dictionary<string, string> LangLabel = new()
    {
        ["c"] = "C (GCC)",
        ["cpp"] = "C++ (G++)",
        ["python"] = "Python 3",
        ["javascript"] = "Node.js",
    };

    public static bool Supports(string language)
    {
        return LangLabel.ContainsKey(language);
    }

    private static string? FindTool(params string[] names)
    {
        var pathVar = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrEmpty(pathVar)) return null;
        foreach (var dir in pathVar.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
            foreach (var n in names)
            {
                var full = Path.Combine(dir, n);
                if (File.Exists(full)) return full;
            }
        return null;
    }

    public static JudgeResult Judge(JudgeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code)) return CompileS(new JudgeResult { Status = Status.CompileError, Detail = "空代码" });
        if (req.Tests is null || req.Tests.Count == 0)
            return new JudgeResult { Status = Status.SystemError, Detail = "缺少测试数据" };
        if (!LangLabel.ContainsKey(req.Language))
            return new JudgeResult { Status = Status.SystemError, Detail = $"不支持的语言: {req.Language}" };

        var sandbox = Sandbox.CreateSandboxDir(out _);
        try
        {
            // 1. prepare source entry
            var (prepareOk, prepareErr) = Prepare(sandbox, req);
            if (!prepareOk)
                return new JudgeResult
                {
                    Status = Status.SystemError,
                    Detail = "评测环境错误: " + prepareErr,
                };

            // 2. compile (languages that need it)
            var compileErr = Compile(sandbox, req);
            if (compileErr != null)
                return new JudgeResult { Status = Status.CompileError, Detail = compileErr, Score = 0 };

            // 3. run each test case
            var total = req.Tests.Count;
            var passed = 0;
            long maxTime = 0;
            long maxRss = 0;
            string? failDetail = null;

            for (var i = 0; i < total; i++)
            {
                var t = req.Tests[i];
                var (exit, so, se, timeMs, rssKb) = RunOne(sandbox, req, t.Input);

                if (timeMs.HasValue) maxTime = Math.Max(maxTime, timeMs.Value);
                if (rssKb.HasValue) maxRss = Math.Max(maxRss, rssKb.Value);

                if (exit == 124)
                    return new JudgeResult
                    {
                        Status = Status.TimeLimitExceeded,
                        TimeMs = maxTime,
                        MemoryKb = maxRss,
                        Score = Percent(passed, total),
                        Detail = $"On test {i + 1}: time limit exceeded",
                    };

                if (exit != 0)
                    return new JudgeResult
                    {
                        Status = Status.RuntimeError,
                        TimeMs = maxTime,
                        MemoryKb = maxRss,
                        Score = Percent(passed, total),
                        Detail = $"On test {i + 1}: runtime error\n{(se.Length > 300 ? se[..300] : se)}",
                    };

                if (!Normalize(so).Equals(Normalize(t.Output), StringComparison.Ordinal))
                    return new JudgeResult
                    {
                        Status = Status.WrongAnswer,
                        TimeMs = maxTime,
                        MemoryKb = maxRss,
                        Score = Percent(passed, total),
                        Detail =
                            $"On test {i + 1}:\n  expected: \"{Truncate(t.Output)}\"\n  got:      \"{Truncate(so)}\"",
                    };

                passed++;
            }

            return new JudgeResult
            {
                Status = Status.Accepted,
                TimeMs = maxTime,
                MemoryKb = maxRss,
                Score = 100,
                Detail = $"All {total} tests passed",
            };
        }
        finally
        {
            Sandbox.Cleanup(sandbox);
        }
    }

    private static int Percent(int passed, int total) =>
        total <= 0 ? 0 : (int)Math.Floor(passed * 100.0 / total);

    private static string Truncate(string s) => s.Length <= 200 ? s : s[..200] + "…";

    private static string Quote(string s) => "'" + s.Replace("\\", "\\\\").Replace("'", "\\'") + "'";

    private static string Normalize(string s)
    {
        // strip CR, trailing whitespace per line, trailing blank lines
        var lines = s.Replace("\r\n", "\n").Split('\n');
        var result = new StringBuilder();
        foreach (var ln in lines) result.AppendLine(ln.TrimEnd(' ', '\t'));
        return result.ToString().TrimEnd('\n');
    }

    private static JudgeResult CompileS(JudgeResult r) => r;

    private static (bool Ok, string? Err) Prepare(string dir, JudgeRequest req)
    {
        try
        {
            if (req.Language is "c")
            {
                File.WriteAllText(Path.Combine(dir, "main.c"), req.Code, Encoding.UTF8);
                return (true, null);
            }
            if (req.Language is "cpp")
            {
                File.WriteAllText(Path.Combine(dir, "main.cpp"), req.Code, Encoding.UTF8);
                return (true, null);
            }
            if (req.Language is "python")
            {
                // shebang-free: write the file without a BOM
                File.WriteAllText(Path.Combine(dir, "main.py"), req.Code, new UTF8Encoding(false));
                return (true, null);
            }
            if (req.Language is "javascript")
            {
                File.WriteAllText(Path.Combine(dir, "main.js"), req.Code, Encoding.UTF8);
                return (true, null);
            }
            return (false, "unsupported");
        }
        catch (Exception e)
        {
            return (false, e.Message);
        }
    }

    /// <summary>Returns null when compile succeeded; otherwise a Compile Error message.</summary>
    private static string? Compile(string dir, JudgeRequest req)
    {
        if (req.Language is "c")
        {
            var gcc = FindTool("gcc", "cc");
            if (gcc == null) return "gcc 不可用";
            var (exit, _, err) = Sandbox.RunProcess(
                dir, gcc,
                new[] { "main.c", "-O2", "-static", "-o", "prog" },
                "", Math.Max(500, req.TimeLimitMs * 2), req.MemoryLimitMb,
                out _, out _);
            return exit == 0 ? null : ("编译错误:\n" + (err.Length > 400 ? err[..400] : err));
        }
        if (req.Language is "cpp")
        {
            var gpp = FindTool("g++", "g++-13", "c++");
            if (gpp == null) return "g++ 不可用";
            var (exit, _, err) = Sandbox.RunProcess(
                dir, gpp,
                new[] { "main.cpp", "-O2", "-static", "-o", "prog" },
                "", Math.Max(500, req.TimeLimitMs * 2), req.MemoryLimitMb,
                out _, out _);
            return exit == 0 ? null : ("编译错误:\n" + (err.Length > 400 ? err[..400] : err));
        }
        // interpreted languages need no compile step
        return null;
    }

    private static (int Exit, string Out, string Err, long? Ms, long? Rss) RunOne(
        string dir, JudgeRequest req, string input)
    {
        if (req.Language is "c" or "cpp")
        {
            var exe = Path.Combine(dir, "prog");
            return Sandbox.RunProcess(dir, exe, Array.Empty<string>(), input,
                req.TimeLimitMs, req.MemoryLimitMb, out var ms, out var rss);
        }
        if (req.Language is "python")
        {
            var py = FindTool("python3", "python");
            if (py == null) return (127, "", "python3 不可用", null, null);
            return Sandbox.RunProcess(dir, py, new[] { Path.Combine(dir, "main.py") }, input,
                req.TimeLimitMs, req.MemoryLimitMb, out var ms, out var rss);
        }
        if (req.Language is "javascript")
        {
            var node = FindTool("node", "nodejs");
            if (node == null) return (127, "", "node 不可用", null, null);
            // Run a Node bootstrap that mimics the old contract: user code reads
            // global `input`, prints via console.log, or defines main/solve and
            // returns the result.
            var srcFile = Path.Combine(dir, "main.js").Replace("\\", "/");
            var bootstrap = Path.Combine(dir, "bootstrap.js");
            File.WriteAllText(bootstrap,
                "const fs=require('fs'),vm=require('vm');\n" +
                "const __src=fs.readFileSync(" + Quote(srcFile) + ",'utf8');\n" +
                "const __in=fs.readFileSync(0,'utf8')||'';\n" +
                "const input=__in.replace(/\\r\\n/g,'\\n');\n" +
                "let __out='';\n" +
                "const sandbox={\n" +
                "  input,\n" +
                "  output:'',\n" +
                "  console:{log:function(){__out+=Array.prototype.map.call(arguments,String).join(' ')+'\\n'}},\n" +
                "  readline:(()=>{const L=__in.split(/\\r?\\n/);let i=0;return()=>i<L.length?L[i++]:''})(),\n" +
                "  log:function(){__out+=Array.prototype.map.call(arguments,String).join(' ')+'\\n'},\n" +
                "  process,require,Buffer,setTimeout,clearTimeout,setInterval,clearInterval\n" +
                "};\n" +
                "vm.createContext(sandbox);\n" +
                "vm.runInContext(__src,sandbox,{timeout:" + Math.Max(50, req.TimeLimitMs + 150) + "});\n" +
                "if(typeof sandbox.main==='function'){const r=sandbox.main(input);if(r!==undefined&&r!==null&&!sandbox.output)sandbox.output=String(r);}\n" +
                "if(typeof sandbox.solve==='function'){const r=sandbox.solve(input);if(r!==undefined&&r!==null&&!sandbox.output)sandbox.output=String(r);}\n" +
                "process.stdout.write(__out+(sandbox.output||''));\n");
            return Sandbox.RunProcess(dir, node, new[] { bootstrap }, input,
                req.TimeLimitMs, req.MemoryLimitMb, out var ms, out var rss);
        }
        return (127, "", "unsupported", null, null);
    }
}
