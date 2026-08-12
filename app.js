// 默认奖品配置（来自Excel数据）
const DEFAULT_PRIZES = [
  { id: '1', name: '特等奖', prize: '吃火锅', baseProbability: 0.005 },
  { id: '2', name: '一等奖', prize: '吃烧烤', baseProbability: 0.01 },
  { id: '3', name: '二等奖', prize: '去商场', baseProbability: 0.005 },
  { id: '4', name: '三等奖', prize: '自驾游', baseProbability: 0.001 },
  { id: '5', name: '四等奖', prize: '去玩水', baseProbability: 0.005 },
  { id: '6', name: '五等奖', prize: '吃披萨', baseProbability: 0.01 },
  { id: '7', name: '六等奖', prize: '吃汉堡', baseProbability: 0.02 },
  { id: '8', name: '七等奖', prize: '吃冷饮', baseProbability: 0.01 },
  { id: '9', name: '八等奖', prize: '再抽一次', baseProbability: 0.15 },
  { id: '10', name: '安慰奖', prize: '10积分', baseProbability: 0.784 },
];

const DEFAULT_COST = 50;
const ADMIN_PASSWORD = 'admin123';
const CONSOLATION_PRIZE_NAME = '安慰奖';

// 颜色配置
const WHEEL_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
];

// 数据存储键
const STORAGE_KEYS = {
  POINTS: 'lottery_points',
  PRIZES: 'lottery_prizes',
  DEFAULT_COST: 'lottery_default_cost',
  HISTORY: 'lottery_history',
};

// ==================== 数据管理 ====================

function getStorage(key, defaultValue) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getPoints() {
  return getStorage(STORAGE_KEYS.POINTS, 0);
}

function setPoints(points) {
  setStorage(STORAGE_KEYS.POINTS, points);
  updatePointsDisplay();
}

function getPrizes() {
  return getStorage(STORAGE_KEYS.PRIZES, DEFAULT_PRIZES);
}

function setPrizes(prizes) {
  setStorage(STORAGE_KEYS.PRIZES, prizes);
}

function getDefaultCost() {
  return getStorage(STORAGE_KEYS.DEFAULT_COST, DEFAULT_COST);
}

function setDefaultCost(cost) {
  setStorage(STORAGE_KEYS.DEFAULT_COST, cost);
}

function getHistory() {
  return getStorage(STORAGE_KEYS.HISTORY, []);
}

function addHistory(record) {
  const history = getHistory();
  history.unshift(record);
  // 只保留最近100条
  if (history.length > 100) {
    history.length = 100;
  }
  setStorage(STORAGE_KEYS.HISTORY, history);
  renderHistory();
}

function clearHistory() {
  setStorage(STORAGE_KEYS.HISTORY, []);
  renderHistory();
}

function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.POINTS);
  localStorage.removeItem(STORAGE_KEYS.PRIZES);
  localStorage.removeItem(STORAGE_KEYS.DEFAULT_COST);
  localStorage.removeItem(STORAGE_KEYS.HISTORY);
  location.reload();
}

// ==================== 概率计算 ====================

/**
 * 根据消耗积分计算实际概率
 * 积分越高，除安慰奖外概率按比例提升
 */
function calculateProbabilities(cost) {
  const prizes = getPrizes();
  const defaultCost = getDefaultCost();

  // 计算提升比例
  const boostRatio = cost / defaultCost;

  let totalNonConsolationProb = 0;
  let consolationPrize = null;

  // 先找出安慰奖和计算非安慰奖的总概率
  for (const p of prizes) {
    if (p.name === CONSOLATION_PRIZE_NAME) {
      consolationPrize = p;
    } else {
      totalNonConsolationProb += p.baseProbability;
    }
  }

  const newProbabilities = [];
  let newTotalNonConsolation = 0;

  // 计算提升后的非安慰奖概率
  for (const p of prizes) {
    if (p.name === CONSOLATION_PRIZE_NAME) {
      continue;
    }
    const newProb = Math.min(p.baseProbability * boostRatio, 1);
    newTotalNonConsolation += newProb;
    newProbabilities.push({ ...p, actualProbability: newProb });
  }

  // 安慰奖概率 = 1 - 提升后的非安慰奖总概率
  const consolationProb = Math.max(0, 1 - newTotalNonConsolation);
  if (consolationPrize) {
    newProbabilities.push({
      ...consolationPrize,
      actualProbability: consolationProb,
    });
  }

  // 归一化（确保总和为1）
  const total = newProbabilities.reduce((sum, p) => sum + p.actualProbability, 0);
  for (const p of newProbabilities) {
    p.actualProbability = p.actualProbability / total;
  }

  return newProbabilities;
}

/**
 * 根据概率抽奖
 */
function drawLottery(cost) {
  const probabilities = calculateProbabilities(cost);
  const random = Math.random();
  let cumulative = 0;

  for (const p of probabilities) {
    cumulative += p.actualProbability;
    if (random <= cumulative) {
      return p;
    }
  }

  // 兜底返回最后一个
  return probabilities[probabilities.length - 1];
}

// ==================== UI 渲染 ====================

function updatePointsDisplay() {
  const el = document.getElementById('userPoints');
  if (el) {
    el.textContent = getPoints();
  }
  updateDrawButtonState();
}

function updateDrawButtonState() {
  const btnDraw = document.getElementById('btnDraw');
  const costInput = document.getElementById('costInput');
  const cost = parseInt(costInput?.value, 10) || getDefaultCost();
  const points = getPoints();
  if (btnDraw) {
    btnDraw.disabled = points < cost || isSpinning;
  }
}

function renderWheel() {
  const wheel = document.getElementById('lotteryWheel');
  const prizes = getPrizes();
  const count = prizes.length;
  const anglePerItem = 360 / count;

  // 使用 conic-gradient 创建转盘背景
  const gradientStops = [];
  for (let i = 0; i < count; i++) {
    const startAngle = i * anglePerItem;
    const endAngle = (i + 1) * anglePerItem;
    const color = WHEEL_COLORS[i % WHEEL_COLORS.length];
    gradientStops.push(`${color} ${startAngle}deg ${endAngle}deg`);
  }
  wheel.style.background = `conic-gradient(${gradientStops.join(', ')})`;

  // 清空并重新添加文字标签（指针在HTML中，不在wheel内部）
  wheel.innerHTML = '';

  const radius = 38; // 文字距离中心的百分比

  prizes.forEach((prize, index) => {
    const angle = index * anglePerItem + anglePerItem / 2;
    const radian = (angle - 90) * (Math.PI / 180);
    const x = 50 + radius * Math.cos(radian);
    const y = 50 + radius * Math.sin(radian);

    const content = document.createElement('div');
    content.className = 'wheel-item';
    content.style.left = `${x}%`;
    content.style.top = `${y}%`;

    const inner = document.createElement('div');
    inner.className = 'wheel-item-content';
    inner.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

    const nameEl = document.createElement('div');
    nameEl.className = 'wheel-item-name';
    nameEl.textContent = prize.name;

    const prizeEl = document.createElement('div');
    prizeEl.className = 'wheel-item-prize';
    prizeEl.textContent = prize.prize;

    inner.appendChild(nameEl);
    inner.appendChild(prizeEl);
    content.appendChild(inner);
    wheel.appendChild(content);
  });
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const history = getHistory();

  if (history.length === 0) {
    list.innerHTML = '<p class="empty-tip">暂无抽奖记录</p>';
    return;
  }

  list.innerHTML = history.map((record) => {
    const date = new Date(record.time);
    const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return `
      <div class="history-item">
        <span class="history-prize">${record.prizeName} - ${record.prize}</span>
        <span class="history-time">${timeStr} | 消耗${record.cost}积分</span>
      </div>
    `;
  }).join('');
}

function renderAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  const prizes = getPrizes();

  tbody.innerHTML = prizes.map((prize, index) => `
    <tr data-index="${index}">
      <td><input type="text" class="admin-name" value="${prize.name}" placeholder="奖项名称"></td>
      <td><input type="text" class="admin-prize" value="${prize.prize}" placeholder="奖品内容"></td>
      <td><input type="number" class="admin-prob" value="${(prize.baseProbability * 100).toFixed(2)}" step="0.01" min="0" max="100" placeholder="概率(%)">%</td>
      <td><button class="btn-delete" onclick="deletePrizeRow(${index})">删除</button></td>
    </tr>
  `).join('');
}

// ==================== 抽奖动画 ====================

let isSpinning = false;
let currentRotation = 0;

function spinWheel(targetIndex) {
  const wheel = document.getElementById('lotteryWheel');
  const prizes = getPrizes();
  const count = prizes.length;
  const anglePerItem = 360 / count;

  // 目标奖项中心角度（在转盘上的原始位置）
  const targetAngle = targetIndex * anglePerItem + anglePerItem / 2;

  // 要让指针指向目标，转盘需要显示的角度
  // 指针在顶部（0度），转盘显示角度 = (360 - targetAngle) % 360
  const targetDisplay = (360 - targetAngle) % 360;

  // 当前转盘显示的角度
  const currentDisplay = currentRotation % 360;

  // 计算需要顺时针旋转的增量（确保总是顺时针旋转）
  let delta = (targetDisplay - currentDisplay + 360) % 360;
  // 如果delta为0，至少转一圈，避免不转动的视觉效果
  if (delta === 0) {
    delta = 360;
  }

  // 加上多圈旋转（至少5圈）
  const spins = 5 + Math.floor(Math.random() * 3);
  const additionalRotation = delta + spins * 360;

  // 在当前角度基础上增加
  currentRotation += additionalRotation;

  wheel.style.transform = `rotate(${currentRotation}deg)`;

  return currentRotation;
}

function showResult(prize) {
  const modal = document.getElementById('resultModal');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const prizeEl = document.getElementById('resultPrize');

  if (prize.name === CONSOLATION_PRIZE_NAME) {
    icon.textContent = '😊';
    title.textContent = '获得安慰奖';
  } else if (prize.name === '特等奖') {
    icon.textContent = '🎊';
    title.textContent = '恭喜中特等奖！';
  } else {
    icon.textContent = '🎉';
    title.textContent = `恭喜中${prize.name}！`;
  }

  prizeEl.textContent = `奖品：${prize.prize}`;
  modal.classList.add('active');
}

function hideResult() {
  document.getElementById('resultModal').classList.remove('active');
}

// ==================== 事件处理 ====================

function handleDraw(isFree = false) {
  // 防止事件对象被当作 isFree 参数
  if (typeof isFree !== 'boolean') {
    isFree = false;
  }

  if (isSpinning) return;

  const costInput = document.getElementById('costInput');
  const cost = parseInt(costInput.value, 10) || getDefaultCost();

  const points = getPoints();

  // 只有非免费抽奖才扣积分
  if (!isFree) {
    if (points < cost) {
      alert('积分不足，请先充值！');
      return;
    }
    // 扣除积分
    setPoints(points - cost);
    // 显示积分扣除提示
    showPointsChange(-cost);
  }

  isSpinning = true;
  const btnDraw = document.getElementById('btnDraw');
  btnDraw.disabled = true;

  // 抽奖
  const result = drawLottery(cost);
  const prizes = getPrizes();
  const targetIndex = prizes.findIndex((p) => p.id === result.id);

  // 旋转转盘
  spinWheel(targetIndex);

  // 4秒后显示结果
  setTimeout(() => {
    showResult(result);

    // 记录历史（免费抽奖记录消耗为0）
    addHistory({
      prizeName: result.name,
      prize: result.prize,
      cost: isFree ? 0 : cost,
      time: Date.now(),
    });

    // 处理"再抽一次"
    if (result.prize === '再抽一次') {
      setTimeout(() => {
        hideResult();
        setTimeout(() => {
          isSpinning = false;
          btnDraw.disabled = false;
          handleDraw(true); // 免费再抽一次
        }, 500);
      }, 1500);
      return;
    }

    // 处理"10积分"安慰奖
    if (result.prize === '10积分') {
      setPoints(getPoints() + 10);
      showPointsChange(10);
    }

    isSpinning = false;
    btnDraw.disabled = false;
  }, 4000);
}

// 显示积分变化提示（扣除/增加）
function showPointsChange(change) {
  const el = document.getElementById('userPoints');
  if (!el) return;

  // 移除旧的提示
  const oldTip = document.querySelector('.points-change-tip');
  if (oldTip) oldTip.remove();

  // 创建提示元素
  const tip = document.createElement('span');
  tip.className = 'points-change-tip';
  tip.textContent = change > 0 ? `+${change}` : `${change}`;
  tip.style.color = change > 0 ? '#27ae60' : '#ff6b6b';

  // 插入到积分值后面
  el.parentElement.appendChild(tip);

  // 动画结束后移除
  setTimeout(() => {
    tip.remove();
  }, 1500);
}

function handleRecharge(amount) {
  const current = getPoints();
  setPoints(current + amount);
  alert(`成功充值 ${amount} 积分！`);
}

function handleAdminLogin() {
  const password = document.getElementById('adminPassword').value;
  if (password === ADMIN_PASSWORD) {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('adminContent').classList.toggle('active');
    document.getElementById('adminPassword').value = '';
    renderAdminTable();
  } else {
    alert('密码错误！');
  }
}

function handleSavePrizes() {
  const rows = document.querySelectorAll('#adminTableBody tr');
  const newPrizes = [];
  let totalProb = 0;

  rows.forEach((row) => {
    const name = row.querySelector('.admin-name').value.trim();
    const prize = row.querySelector('.admin-prize').value.trim();
    const probPercent = parseFloat(row.querySelector('.admin-prob').value) || 0;
    const prob = probPercent / 100;

    if (name && prize) {
      newPrizes.push({
        id: String(Date.now() + Math.random()),
        name,
        prize,
        baseProbability: prob,
      });
      totalProb += prob;
    }
  });

  // 自动调整安慰奖概率使总和为1
  const consolationIndex = newPrizes.findIndex((p) => p.name === CONSOLATION_PRIZE_NAME);
  if (consolationIndex >= 0 && totalProb < 1) {
    newPrizes[consolationIndex].baseProbability = 1 - (totalProb - newPrizes[consolationIndex].baseProbability);
  }

  setPrizes(newPrizes);
  renderWheel();
  alert('奖品设置已保存！');
}

function deletePrizeRow(index) {
  const rows = document.querySelectorAll('#adminTableBody tr');
  if (rows[index]) {
    rows[index].remove();
  }
}

function handleAddPrize() {
  const tbody = document.getElementById('adminTableBody');
  const newRow = document.createElement('tr');
  const index = tbody.children.length;
  newRow.innerHTML = `
    <td><input type="text" class="admin-name" placeholder="奖项名称"></td>
    <td><input type="text" class="admin-prize" placeholder="奖品内容"></td>
    <td><input type="number" class="admin-prob" value="1.00" step="0.01" min="0" max="100" placeholder="概率(%)">%</td>
    <td><button class="btn-delete" onclick="deletePrizeRow(${index})">删除</button></td>
  `;
  tbody.appendChild(newRow);
}

// ==================== 初始化 ====================

function init() {
  // 初始化数据
  if (!localStorage.getItem(STORAGE_KEYS.PRIZES)) {
    setPrizes(DEFAULT_PRIZES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.DEFAULT_COST)) {
    setDefaultCost(DEFAULT_COST);
  }

  // 设置默认消耗积分
  const costInput = document.getElementById('costInput');
  costInput.value = getDefaultCost();
  document.getElementById('drawCost').textContent = `${getDefaultCost()}积分`;
  document.getElementById('defaultCostInput').value = getDefaultCost();

  // 更新积分显示
  updatePointsDisplay();

  // 检查并更新抽奖按钮状态
  updateDrawButtonState();

  // 渲染转盘
  renderWheel();

  // 渲染历史记录
  renderHistory();

  // 绑定事件
  document.getElementById('btnDraw').addEventListener('click', handleDraw);

  // 管理员充值
  document.getElementById('btnAdminRecharge').addEventListener('click', () => {
    const input = document.getElementById('adminRechargeInput');
    const amount = parseInt(input.value, 10);
    if (amount > 0) {
      handleRecharge(amount);
      input.value = '';
    } else {
      alert('请输入有效的积分数量！');
    }
  });

  // 扫码充值（上传图片识别数字）
  const scanImageInput = document.getElementById('scanImageInput');
  const scanImageResult = document.getElementById('scanImageResult');
  const scanImageAmount = document.getElementById('scanImageAmount');

  document.getElementById('btnScanImage').addEventListener('click', () => {
    scanImageInput.click();
  });

  scanImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 显示识别中提示
    const btnScanImage = document.getElementById('btnScanImage');
    btnScanImage.textContent = '⏳ 识别中...';
    btnScanImage.disabled = true;

    // 使用 Tesseract.js 识别图片中的数字
    Tesseract.recognize(
      file,
      'eng',
      { logger: () => {} }
    ).then(({ data }) => {
      // 从识别文本中提取数字
      const text = data.text;
      const numbers = text.match(/\d+/g);
      let amount = 0;
      if (numbers && numbers.length > 0) {
        // 取最大的数字作为金额
        amount = Math.max(...numbers.map(Number));
      }

      // 显示识别结果
      scanImageAmount.value = amount > 0 ? amount : '';
      scanImageResult.style.display = 'block';
    }).catch((err) => {
      console.error('识别失败:', err);
      alert('图片识别失败，请重试或手动输入金额');
    }).finally(() => {
      btnScanImage.textContent = '📷 上传图片识别';
      btnScanImage.disabled = false;
      scanImageInput.value = '';
    });
  });

  document.getElementById('btnConfirmScanImage').addEventListener('click', () => {
    const amount = parseInt(scanImageAmount.value, 10);
    if (amount > 0) {
      handleRecharge(amount);
      scanImageResult.style.display = 'none';
      scanImageAmount.value = '';
    } else {
      alert('请输入有效的积分数量！');
    }
  });

  document.getElementById('adminToggle').addEventListener('click', () => {
    const adminContent = document.getElementById('adminContent');
    if (adminContent.classList.contains('active')) {
      adminContent.classList.remove('active');
    } else {
      document.getElementById('loginModal').classList.add('active');
    }
  });

  document.getElementById('btnLogin').addEventListener('click', handleAdminLogin);
  document.getElementById('btnCancelLogin').addEventListener('click', () => {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('adminPassword').value = '';
  });

  document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAdminLogin();
    }
  });

  document.getElementById('btnSavePrizes').addEventListener('click', handleSavePrizes);
  document.getElementById('btnAddPrize').addEventListener('click', handleAddPrize);

  // 管理员退出按钮
  document.getElementById('btnAdminExit').addEventListener('click', () => {
    document.getElementById('adminContent').classList.remove('active');
  });

  // 保存并退出按钮
  document.getElementById('btnSaveAndExit').addEventListener('click', () => {
    // 保存奖品设置
    handleSavePrizes();
    // 保存默认消耗
    const cost = parseInt(document.getElementById('defaultCostInput').value, 10);
    if (cost > 0) {
      setDefaultCost(cost);
      document.getElementById('costInput').value = cost;
      document.getElementById('drawCost').textContent = `${cost}积分`;
    }
    // 关闭面板
    document.getElementById('adminContent').classList.remove('active');
    alert('所有设置已保存并退出！');
  });

  document.getElementById('btnSaveDefaultCost').addEventListener('click', () => {
    const cost = parseInt(document.getElementById('defaultCostInput').value, 10);
    if (cost > 0) {
      setDefaultCost(cost);
      document.getElementById('costInput').value = cost;
      document.getElementById('drawCost').textContent = `${cost}积分`;
      alert('默认消耗积分已保存！');
    }
  });

  document.getElementById('btnClearHistory').addEventListener('click', () => {
    if (confirm('确定要清空所有抽奖记录吗？')) {
      clearHistory();
      alert('记录已清空！');
    }
  });

  document.getElementById('btnResetData').addEventListener('click', () => {
    if (confirm('确定要重置所有数据吗？这将清空积分、奖品设置和抽奖记录！')) {
      resetAllData();
    }
  });

  document.getElementById('btnConfirm').addEventListener('click', hideResult);

  document.getElementById('costInput').addEventListener('input', (e) => {
    const cost = parseInt(e.target.value, 10) || getDefaultCost();
    document.getElementById('drawCost').textContent = `${cost}积分`;
    updateDrawButtonState();
  });

  // 点击弹窗外部关闭
  document.getElementById('resultModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      hideResult();
    }
  });

  document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('loginModal').classList.remove('active');
    }
  });

  // 注册 Service Worker（PWA 离线支持）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service Worker 注册成功:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker 注册失败:', error);
      });
  }

  // 添加到主屏幕提示
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // 可以在这里显示一个"添加到主屏幕"的提示按钮
    console.log('可以添加到主屏幕');
  });

  // 检测是否已安装为 PWA
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
    console.log('已以 PWA 模式运行');
    document.body.classList.add('pwa-mode');
  }
}

// 启动
document.addEventListener('DOMContentLoaded', init);
