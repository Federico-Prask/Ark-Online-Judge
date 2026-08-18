namespace ArkJudgeService;

/// <summary>A single test case resolved from the request.</summary>
public sealed class TestCase
{
    public string Input { get; set; } = "";
    public string Output { get; set; } = "";
}

/// <summary>Values sent by the Node backend to judge one submission.</summary>
public sealed class JudgeRequest
{
    public string Language { get; set; } = "";
    public string Code { get; set; } = "";
    public int TimeLimitMs { get; set; } = 1000;
    public int MemoryLimitMb { get; set; } = 256;
    public List<TestCase> Tests { get; set; } = new();
}

/// <summary>Judge verdict returned to the Node backend.</summary>
public sealed class JudgeResult
{
    public string Status { get; set; } = "System Error";
    public long? TimeMs { get; set; }
    public long? MemoryKb { get; set; }
    public int Score { get; set; }
    public string? Detail { get; set; }
}
