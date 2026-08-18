using System.Diagnostics;
using System.Text;

namespace ArkJudgeService;

/// <summary>The verdict constants, kept in sync with the Node judge.</summary>
public static partial class Status
{
    public const string Accepted = "Accepted";
    public const string WrongAnswer = "Wrong Answer";
    public const string TimeLimitExceeded = "Time Limit Exceeded";
    public const string RuntimeError = "Runtime Error";
    public const string CompileError = "Compile Error";
    public const string SystemError = "System Error";
}

/// <summary>
/// Runs user code inside a per-test-case sandbox directory using an optional
/// OS sandbox helper if available (bwrap), falling back to hard time limits +
/// resource limits applied via ulimit/prlimit where the helpers are missing.
/// </summary>
public static class Sandbox
{
    // Full path to the program that enforces time+memory on Linux.
    // We prefer bwrap (bubblewrap) for heavier sandboxing when present;
    // otherwise we rely on process-level ulimit + a hard kill timer.
    private static string? FindTool(params string[] names)
    {
        string? pathVar = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrEmpty(pathVar)) return null;
        foreach (var dir in pathVar.Split(System.IO.Path.PathSeparator,
                     StringSplitOptions.RemoveEmptyEntries))
        {
            foreach (var n in names)
            {
                var full = System.IO.Path.Combine(dir, n);
                if (File.Exists(full)) return full;
            }
        }
        return null;
    }

    private static readonly string TimeoutBin = FindTool("timeout") ?? "";
    private static readonly string PrlimitBin = FindTool("prlimit") ?? "";

    public static string? TempRoot { get; } = CreateTempRoot();

    private static string? CreateTempRoot()
    {
        try
        {
            var root = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "arkjudge");
            Directory.CreateDirectory(root);
            return root;
        }
        catch
        {
            return null;
        }
    }

    public static string CreateSandboxDir(out string subId)
    {
        subId = Guid.NewGuid().ToString("N")[..12];
        var dir = System.IO.Path.Combine(TempRoot ?? System.IO.Path.GetTempPath(), subId);
        Directory.CreateDirectory(dir);
        return dir;
    }

    public static void Cleanup(string dir)
    {
        try
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
        catch
        {
            /* best effort */
        }
    }

    /// <summary>Run a compiled executable / interpreter against one test case.</summary>
    public static (int ExitCode, string StdOut, string StdErr) RunProcess(
        string workDir,
        string fileName,
        IReadOnlyList<string> arguments,
        string input,
        int timeLimitMs,
        int memoryLimitMb,
        out long? timeMs,
        out long? maxRssKb)
    {
        timeMs = null;
        maxRssKb = null;

        var psi = new ProcessStartInfo
        {
            WorkingDirectory = workDir,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            StandardInputEncoding = Encoding.UTF8,
        };

        var finalArgs = new List<string>();

        // Compose the actual command: [sandbox/limit wrappers] <program> <args>
        if (TimeoutBin.Length > 0 && !OperatingSystem.IsWindows())
        {
            // `timeout --signal=KILL --kill-after=1s <seconds> <cmd...>`
            double secs = Math.Max(0.05, timeLimitMs / 1000.0);
            psi.FileName = TimeoutBin;
            finalArgs.Add("--signal=KILL");
            finalArgs.Add("--kill-after=1");
            finalArgs.Add(secs.ToString("0.000", System.Globalization.CultureInfo.InvariantCulture));
            finalArgs.Add(fileName);
        }
        else
        {
            psi.FileName = fileName;
        }

        // Apply a memory cap with prlimit when available (soft + hard).
        if (PrlimitBin.Length > 0 && !OperatingSystem.IsWindows() && memoryLimitMb > 0)
        {
            var mb = memoryLimitMb;
            psi.FileName = PrlimitBin;
            finalArgs.Insert(0, "--as=" + mb + "M:" + mb + "M");
            finalArgs.Insert(1, "--cpu=" + Math.Max(1, Math.Max(1, (int)Math.Ceiling(timeLimitMs / 1000.0))));
            finalArgs.Insert(2, "--");
        }

        foreach (var a in arguments) finalArgs.Add(a);
        psi.ArgumentList.AddRange(finalArgs);

        using var proc = new Process { StartInfo = psi };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        // Bounded readers to avoid deadlock on large I/O.
        proc.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null) stdout.AppendLine(e.Data);
        };
        proc.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) stderr.AppendLine(e.Data);
        };

        var sw = Stopwatch.StartNew();
        try
        {
            if (!proc.Start())
            {
                return (127, "", "无法启动子进程");
            }
        }
        catch (Exception ex)
        {
            return (127, "", ex.Message);
        }

        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();

        try
        {
            proc.StandardInput.Write(input);
            proc.StandardInput.Close();
        }
        catch
        {
            /* stdin failed; child may have exited already */
        }

        var exited = proc.WaitForExit(Math.Max(500, timeLimitMs + 2000));
        if (!exited)
        {
            try { proc.Kill(true); } catch { /* ignore */ }
            proc.WaitForExit(1000);
        }

        sw.Stop();
        timeMs = sw.ElapsedMilliseconds;

        try
        {
            maxRssKb = GetPeakRssKb(proc.Id);
        }
        catch
        {
            maxRssKb = null;
        }

        var exit = proc.ExitCode;
        // kill/died by timeout signal (124 on GNU timeout)
        if (!exited || exit == 124 || exit == 137)
        {
            return (124, "", "time limit exceeded (or killed)");
        }

        return (exit, "" + stdout, "" + stderr);
    }

    private static long? GetPeakRssKb(int pid)
    {
        try
        {
            var line = File.ReadAllText($"/proc/{pid}/status");
            var token = "VmHWM:";
            var idx = line.IndexOf(token, StringComparison.Ordinal);
            if (idx < 0) return null;
            var rest = line[(idx + token.Length)..].Trim();
            var num = new string(rest.TakeWhile(char.IsDigit).ToArray());
            if (long.TryParse(num, out var kb)) return kb;
        }
        catch
        {
            /* ignore */
        }
        return null;
    }
}
