// 题目：题面 + 测试点（后端是唯一事实来源，tests 绝不下发前端）
export interface Test {
  in: string
  out: string
}
export interface Problem {
  id: string
  title: string
  base: number // 官方难度 1-8
  tags: string[]
  ac: number // 初始 AC 人数（种子用户）
  submitted: number // 初始提交总数
  tl: number // 单点时限 ms
  statement: string[]
  input: string
  output: string
  samples: Test[]
  tests: Test[]
  visibility?: 'hidden' | 'public' | 'contest' // 隐藏 / 公开 / 比赛（赛时仅比赛页可见，赛后自动公开）
  interactive?: boolean // 交互题
  interactor?: string // 交互器 C++ 源码：stdin=测试输入，argv[1]=结果文件（写 1/0），与选手程序全双工
}

export const problems: Problem[] = [
  {
    id: 'P1001', title: '源石计数', base: 1, tags: ['模拟', '数学'],
    ac: 2137, submitted: 4890, tl: 1000,
    statement: [
      '勘探队在一条笔直的天灾走廊上部署了 n 枚监测信标，第 i 枚信标记录的源石读数为 a_i。',
      '请计算所有信标读数的总和，并输出它对 10^9+7 取模的结果。',
    ],
    input: '第一行一个整数 n。第二行 n 个整数 a_i。',
    output: '一个整数，表示读数和模 10^9+7。',
    samples: [{ in: '3\n1 2 3', out: '6' }],
    tests: [
      { in: '3\n1 2 3', out: '6' },
      { in: '2\n5 7', out: '12' },
      { in: '1\n1000000007', out: '0' },
      { in: '4\n1000000000 1000000000 1000000000 1000000000', out: '999999979' },
    ],
  },
  {
    id: 'P1002', title: '天灾信标定位', base: 2, tags: ['二分', '排序'],
    ac: 1412, submitted: 3977, tl: 1000,
    statement: [
      '天灾走廊可视为数轴。给定 n 个信标的坐标与 q 次天灾预警的波及半径 r，',
      '每次预警询问：坐标原点处爆发的天灾，波及区间 [-r, r] 内有多少信标。',
    ],
    input: '第一行 n, q。第二行 n 个坐标。接下来 q 行每行一个 r。',
    output: 'q 行，每行一个整数答案。',
    samples: [{ in: '3 2\n-1 0 5\n1\n4', out: '2\n2' }],
    tests: [
      { in: '3 2\n-1 0 5\n1\n4', out: '2\n2' },
      { in: '3 2\n-1 0 5\n5\n0', out: '3\n1' },
      { in: '1 1\n0\n0', out: '1' },
    ],
  },
  {
    id: 'P1007', title: '轨道测绘', base: 4, tags: ['图论', '最短路'],
    ac: 863, submitted: 3251, tl: 1000,
    statement: [
      '轨道网络由 n 个节点与 m 条单向轨道构成，每条轨道有通行耗时 w。',
      '求从 1 号节点到 n 号节点的最短耗时；若不可达输出 -1。',
    ],
    input: '第一行 n, m。接下来 m 行每行 u, v, w。',
    output: '一个整数。',
    samples: [{ in: '3 3\n1 2 1\n2 3 2\n1 3 4', out: '3' }],
    tests: [
      { in: '3 3\n1 2 1\n2 3 2\n1 3 4', out: '3' },
      { in: '3 1\n1 2 5', out: '-1' },
      { in: '2 1\n1 2 7', out: '7' },
    ],
  },
  {
    id: 'P1018', title: '低温储存', base: 2, tags: ['贪心'], visibility: 'contest',
    ac: 977, submitted: 2210, tl: 1000,
    statement: ['有 n 份样本与 k 台低温舱，第 i 台低温舱容量 c_i。每份样本体积为 1。', '求最多可储存的样本数。'],
    input: '第一行 n, k。第二行 k 个整数 c_i。',
    output: '一个整数。',
    samples: [{ in: '5 2\n3 3', out: '5' }],
    tests: [
      { in: '5 2\n3 3', out: '5' },
      { in: '7 3\n2 2 2', out: '6' },
      { in: '3 2\n0 0', out: '0' },
    ],
  },
  {
    id: 'P1019', title: '协议回收', base: 6, tags: ['数据结构', '线段树'],
    ac: 217, submitted: 1524, tl: 1000,
    statement: ['维护长为 n 的协议序列，支持：区间加、区间求和。共 q 次操作。'],
    input: '第一行 n, q。第二行初始序列。接下来 q 行操作 1 l r v 或 2 l r。',
    output: '对每个操作 2 输出区间和。',
    samples: [{ in: '5 2\n1 2 3 4 5\n2 1 5\n1 1 3 1\n2 1 5', out: '15\n18' }],
    tests: [
      { in: '5 2\n1 2 3 4 5\n2 1 5\n1 1 3 1\n2 1 5', out: '15\n18' },
      { in: '3 1\n1 2 3\n2 1 3', out: '6' },
      { in: '4 2\n1 1 1 1\n1 2 3 5\n2 1 4', out: '14' },
    ],
  },
  {
    id: 'P1024', title: '向渊而行', base: 5, tags: ['图论', 'DP'],
    ac: 402, submitted: 1893, tl: 1000,
    statement: [
      '深渊共有 n 层，从第 i 层可下潜至 i+1 或 i+2 层，代价分别为 a_i 与 b_i。',
      '求从第 1 层到第 n 层的最小代价。',
    ],
    input: '第一行 n。接下来 n-1 行每行 a_i, b_i。',
    output: '一个整数。',
    samples: [{ in: '3\n1 5\n2 1', out: '3' }],
    tests: [
      { in: '3\n1 5\n2 1', out: '3' },
      { in: '2\n7 2', out: '2' },
      { in: '4\n1 9\n9 1\n1 9', out: '2' },
    ],
  },
  {
    id: 'P1031', title: '信号中继', base: 3, tags: ['贪心', '排序'], visibility: 'contest',
    ac: 688, submitted: 2044, tl: 1000,
    statement: ['n 个中继站排成一行，第 i 个的信号强度 s_i。每次操作可将一个站强度 +1。', '求使所有相邻站强度不同的最小操作数。'],
    input: '第一行 n。第二行 n 个整数 s_i。',
    output: '一个整数。',
    samples: [{ in: '3\n1 1 1', out: '1' }],
    tests: [
      { in: '3\n1 1 1', out: '1' },
      { in: '3\n1 2 3', out: '0' },
      { in: '4\n1 1 2 2', out: '2' },
    ],
  },
  {
    id: 'P1036', title: '边界协议', base: 1, tags: ['字符串'], visibility: 'contest',
    ac: 1204, submitted: 1650, tl: 1000,
    statement: ['给定字符串 s，判断它是否以 "ARK" 为前缀且以 "OJ" 为后缀。'],
    input: '一行字符串 s。',
    output: '是则输出 YES，否则 NO。',
    samples: [{ in: 'ARKxxOJ', out: 'YES' }],
    tests: [
      { in: 'ARKxxOJ', out: 'YES' },
      { in: 'ARKOJ', out: 'YES' },
      { in: 'ARK', out: 'NO' },
      { in: 'xxOJ', out: 'NO' },
    ],
  },
  {
    id: 'P1042', title: '深空回声', base: 5, tags: ['图论', '最短路'],
    ac: 355, submitted: 1478, tl: 1000,
    statement: ['给定一张带权有向图。你可以将至多一条边反向。', '求反向后 1 到 n 的最短路的最小可能值。'],
    input: '第一行 n, m。接下来 m 行 u, v, w。',
    output: '一个整数。',
    samples: [{ in: '3 2\n1 2 3\n3 2 1', out: '4' }],
    tests: [
      { in: '3 2\n1 2 3\n3 2 1', out: '4' },
      { in: '2 1\n1 2 5', out: '5' },
      { in: '3 2\n1 2 3\n2 3 4', out: '7' },
    ],
  },
  {
    id: 'P1050', title: '尘暴预警', base: 8, tags: ['计算几何', '扫描线'],
    ac: 47, submitted: 611, tl: 1000,
    statement: ['n 场尘暴各覆盖一个轴平行矩形。求被至少 k 场尘暴同时覆盖的面积并。'],
    input: '第一行 n, k。接下来 n 行 x1, y1, x2, y2。',
    output: '一个整数。',
    samples: [{ in: '2 2\n0 0 2 2\n1 1 3 3', out: '1' }],
    tests: [
      { in: '2 2\n0 0 2 2\n1 1 3 3', out: '1' },
      { in: '2 1\n0 0 2 2\n1 1 3 3', out: '7' },
      { in: '2 2\n0 0 1 1\n5 5 6 6', out: '0' },
    ],
  },
  {
    id: 'P1060', title: '向渊行 · 交互', base: 4, tags: ['交互', '二分'],
    ac: 96, submitted: 407, tl: 1000,
    statement: [
      '交互题。评测机心里藏着一个整数 x（1 ≤ x ≤ 1e9）。',
      '你可以输出猜测 g（不超过 30 次），评测机回应 TOO_BIG（g > x）、TOO_SMALL（g < x）。',
      '当你猜中时，评测机回应 CORRECT，程序应立即结束。',
    ],
    input: '无标准输入；通过 stdout 输出猜测，从 stdin 读取回应。',
    output: '见交互协议。',
    samples: [{ in: '(评测机) x = 42\n(你) 50\n(评测机) TOO_BIG\n(你) 25\n(评测机) TOO_SMALL\n…\n(你) 42\n(评测机) CORRECT', out: '' }],
    tests: [{ in: '42', out: '' }, { in: '1000000000', out: '' }, { in: '1', out: '' }],
    interactive: true,
    interactor: `#include <bits/stdc++.h>
using namespace std;
int main(int argc, char** argv) {
  const char* rf = argc > 1 ? argv[1] : "result.txt";
  long long x;
  if (!(cin >> x)) { ofstream(rf) << "0"; return 0; }
  int q = 0;
  long long g;
  while (cin >> g) {
    if (++q > 30) { ofstream(rf) << "0"; return 0; }
    if (g == x) { cout << "CORRECT" << endl; ofstream(rf) << "1"; return 0; }
    cout << (g > x ? "TOO_BIG" : "TOO_SMALL") << endl;
  }
  ofstream(rf) << "0";
  return 0;
}
`,
  },
]

export const problemById = (id: string) => problems.find((p) => p.id === id)
