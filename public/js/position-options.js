/**
 * 按活动人数生成「出场位置」下拉选项，与战术板 formationsByCount 的槽位标签一致。
 * 供报名弹窗（dashboard / activity-detail / activities）使用。
 */
(function () {
  /** 将活动人数规范为支持的槽位数：5, 6, 7, 8, 11 */
  function normalizeSlotCount(n) {
    if (n == null || n < 5) return 5;
    if (n <= 6) return 6;
    if (n <= 7) return 7;
    if (n <= 8) return 8;
    return 11;
  }

  /** 各人数下可选位置标签（与战术板阵型槽位 label 一致，去重保序） */
  var positionLabelsByCount = {
    5: ['守门员', '左后卫', '右后卫', '左前', '右前', '中后卫', '前锋'],
    6: ['守门员', '左后卫', '右后卫', '左前卫', '右前卫', '前锋', '中后卫', '左前', '右前'],
    7: ['守门员', '左后卫', '右后卫', '左前卫', '中前卫', '右前卫', '前锋', '左中卫', '中后卫', '右中卫'],
    8: ['守门员', '左后卫', '右后卫', '左前卫', '中前卫', '右前卫', '左前锋', '右前锋', '左中卫', '中后卫', '右中卫'],
    11: ['守门员', '左后卫', '中后卫', '右后卫', '左前卫', '中前卫', '右前卫', '左影锋', '右影锋', '中锋', '前锋', '左边锋', '右边锋'],
  };

  /** 位置中文名 -> 英文缩写（用于下拉显示） */
  var positionAbbr = {
    守门员: 'GK', 左后卫: 'LB', 右后卫: 'RB', 中后卫: 'CB',
    左中卫: 'LCB', 右中卫: 'RCB',
    左前: 'LM', 右前: 'RM',
    左前卫: 'LM', 右前卫: 'RM', 中前卫: 'CM',
    左边锋: 'LW', 右边锋: 'RW',
    前锋: 'ST', 中锋: 'CF',
    左影锋: 'LSS', 右影锋: 'RSS',
    左前锋: 'LF', 右前锋: 'RF',
  };

  /**
   * 根据活动人数返回可选位置标签数组。
   * @param {number} maxParticipants - 活动人数（如 5、7、11）
   * @returns {string[]}
   */
  function getPositionOptionsForCount(maxParticipants) {
    var count = normalizeSlotCount(maxParticipants);
    return positionLabelsByCount[count] || positionLabelsByCount[11];
  }

  /**
   * 根据活动人数填充「出场位置」下拉框：先清空再填入「未选择」+ 各位置选项。
   * @param {HTMLSelectElement} selectEl - 报名弹窗里的 #registerPositionSelect
   * @param {number} maxParticipants - 活动人数（如 5、7、11）
   */
  function fillPositionSelect(selectEl, maxParticipants) {
    if (!selectEl || !selectEl.options) return;
    var labels = getPositionOptionsForCount(maxParticipants);
    selectEl.innerHTML = '';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '未选择';
    selectEl.appendChild(opt0);
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      var abbr = positionAbbr[label] || '';
      var opt = document.createElement('option');
      opt.value = label;
      opt.textContent = abbr ? label + ' (' + abbr + ')' : label;
      selectEl.appendChild(opt);
    }
  }

  window.getPositionOptionsForCount = getPositionOptionsForCount;
  window.fillPositionSelect = fillPositionSelect;
})();
