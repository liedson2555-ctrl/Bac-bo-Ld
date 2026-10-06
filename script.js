/* =========================================================
   BAC BO ANALYZER
   Versão Manual
   ========================================================= */

const STORAGE_KEY = "bacbo_analyzer_history_v2";

let history = loadHistory();


// =========================================================
// STORAGE
// =========================================================

function loadHistory() {

  try {

    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {

    console.error("Erro ao carregar histórico:", error);

    return [];
  }
}


function saveHistory() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(history)
  );
}


// =========================================================
// HELPERS
// =========================================================

function countResults(list) {

  return {

    P: list.filter(x => x.result === "P").length,
    B: list.filter(x => x.result === "B").length,
    T: list.filter(x => x.result === "T").length

  };
}


function percentage(value, total) {

  if (!total) return 0;

  return ((value / total) * 100).toFixed(1);
}


function getWindowSize() {

  const value = Number(
    document.getElementById("modelWindow").value
  );

  return Math.max(8, Math.min(200, value || 25));
}


function getMinimumConfidence() {

  const value = Number(
    document.getElementById("minimumConfidence").value
  );

  return Math.max(50, Math.min(99, value || 51));
}


function resultName(result) {

  if (result === "P") return "PLAYER";
  if (result === "B") return "BANKER";
  if (result === "T") return "TIE";

  return "—";
}


// =========================================================
// ADD RESULT
// =========================================================

function addResult(result, dice = null) {

  if (!["P", "B", "T"].includes(result)) return;

  history.push({

    result,

    dice,

    timestamp: new Date().toISOString()

  });

  saveHistory();

  render();
}


// =========================================================
// DICE
// =========================================================

function validDie(value) {

  return Number.isInteger(value) &&
         value >= 1 &&
         value <= 6;
}


function calculateDiceResult(p1, p2, b1, b2) {

  const playerTotal = p1 + p2;
  const bankerTotal = b1 + b2;

  if (playerTotal > bankerTotal) {

    return {
      result: "P",
      playerTotal,
      bankerTotal
    };

  }

  if (bankerTotal > playerTotal) {

    return {
      result: "B",
      playerTotal,
      bankerTotal
    };

  }

  return {
    result: "T",
    playerTotal,
    bankerTotal
  };
}


function addDiceResult() {

  const p1 = Number(
    document.getElementById("playerDie1").value
  );

  const p2 = Number(
    document.getElementById("playerDie2").value
  );

  const b1 = Number(
    document.getElementById("bankerDie1").value
  );

  const b2 = Number(
    document.getElementById("bankerDie2").value
  );

  const message =
    document.getElementById("diceMessage");

  if (
    !validDie(p1) ||
    !validDie(p2) ||
    !validDie(b1) ||
    !validDie(b2)
  ) {

    message.textContent =
      "Introduza valores válidos entre 1 e 6.";

    return;
  }

  const calculated =
    calculateDiceResult(p1, p2, b1, b2);

  addResult(
    calculated.result,
    {
      player: [p1, p2],
      banker: [b1, b2],
      playerTotal: calculated.playerTotal,
      bankerTotal: calculated.bankerTotal
    }
  );

  document.getElementById("playerDie1").value = "";
  document.getElementById("playerDie2").value = "";
  document.getElementById("bankerDie1").value = "";
  document.getElementById("bankerDie2").value = "";

  message.textContent =
    `Resultado registado: ${resultName(calculated.result)}`;
}


// =========================================================
// SIGNAL MODEL
// =========================================================

function calculateSignal(
  list,
  windowSize = 25,
  minimumConfidence = 51
) {

  const recent =
    list.slice(-windowSize);

  if (recent.length < 8) {

    return {

      signal: "AGUARDAR",
      confidence: 0,
      reason:
        "É necessário introduzir pelo menos 8 rondas para gerar uma análise."

    };
  }

  const counts =
    countResults(recent);

  const nonTie =
    counts.P + counts.B;

  if (nonTie < 8) {

    return {

      signal: "AGUARDAR",
      confidence: 0,
      reason:
        "Ainda existem poucos resultados Player/Banker para calcular o sinal."

    };
  }

  /*
    Suavização de Laplace.
    Evita que uma amostra pequena produza
    confiança artificialmente extrema.
  */

  const playerRate =
    (counts.P + 1) /
    (nonTie + 2);

  const bankerRate =
    (counts.B + 1) /
    (nonTie + 2);

  const difference =
    Math.abs(playerRate - bankerRate);

  let confidence =
    50 + difference * 100;

  confidence =
    Math.min(99, confidence);

  confidence =
    Math.round(confidence);

  const signal =
    playerRate >= bankerRate
      ? "PLAYER"
      : "BANKER";

  if (confidence < minimumConfidence) {

    return {

      signal: "AGUARDAR",
      confidence,
      reason:
        `A diferença estatística entre Player e Banker não ultrapassa a confiança mínima definida (${minimumConfidence}%).`

    };
  }

  return {

    signal,
    confidence,

    reason:
      `Na janela das últimas ${recent.length} rondas, ${resultName(signal === "PLAYER" ? "P" : "B")} apresenta a maior frequência entre os resultados não-Tie.`
  };
}


// =========================================================
// CURRENT STREAK
// =========================================================

function getCurrentStreak(list) {

  if (!list.length) {

    return {
      result: "—",
      count: 0
    };
  }

  const last =
    list[list.length - 1].result;

  let count = 0;

  for (let i = list.length - 1; i >= 0; i--) {

    if (list[i].result !== last) break;

    count++;
  }

  return {
    result: last,
    count
  };
}


// =========================================================
// MAX STREAKS
// =========================================================

function getMaximumStreaks(list) {

  const max = {
    P: 0,
    B: 0,
    T: 0
  };

  let current = null;
  let count = 0;

  for (const item of list) {

    if (item.result === current) {

      count++;

    } else {

      current = item.result;
      count = 1;

    }

    if (count > max[current]) {

      max[current] = count;
    }
  }

  return max;
}


// =========================================================
// ROAD
// =========================================================

function renderRoad() {

  const container =
    document.getElementById("road");

  container.innerHTML = "";

  const recent =
    history.slice(-80);

  if (!recent.length) {

    container.innerHTML =
      `<span style="color:#8993a5;font-size:13px">
        Ainda não existem rondas.
      </span>`;

    return;
  }

  recent.forEach(item => {

    const dot =
      document.createElement("div");

    dot.className =
      `road-dot road-${item.result}`;

    dot.textContent =
      item.result;

    dot.title =
      resultName(item.result);

    container.appendChild(dot);

  });
}


// =========================================================
// LAST 20
// =========================================================

function renderLast20() {

  const container =
    document.getElementById("last20");

  container.innerHTML = "";

  const recent =
    history.slice(-20);

  if (!recent.length) {

    container.innerHTML =
      `<span style="color:#8993a5;font-size:13px">
        Ainda não existem rondas.
      </span>`;

    return;
  }

  recent.forEach(item => {

    const dot =
      document.createElement("div");

    dot.className =
      `last20-dot last20-${item.result}`;

    dot.textContent =
      item.result;

    dot.title =
      resultName(item.result);

    container.appendChild(dot);

  });
}


// =========================================================
// RECENT WINDOWS
// =========================================================

function formatWindow(size) {

  const recent =
    history.slice(-size);

  if (!recent.length) return "—";

  const counts =
    countResults(recent);

  return `
    P ${counts.P}
    • B ${counts.B}
    • T ${counts.T}
  `;
}


// =========================================================
// TABLE
// =========================================================

function renderTable() {

  const tbody =
    document.getElementById("historyTable");

  tbody.innerHTML = "";

  const recent =
    history.slice(-30).reverse();

  recent.forEach((item, index) => {

    const row =
      document.createElement("tr");

    const originalIndex =
      history.length - index;

    let diceText = "—";
    let totalText = "—";

    if (item.dice) {

      diceText =
        `${item.dice.player.join(" + ")} / ${item.dice.banker.join(" + ")}`;

      totalText =
        `${item.dice.playerTotal} - ${item.dice.bankerTotal}`;
    }

    const date =
      new Date(item.timestamp);

    const time =
      date.toLocaleTimeString(
        "pt-PT",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );

    row.innerHTML = `

      <td>${originalIndex}</td>

      <td>
        <span class="result-label ${item.result}">
          ${resultName(item.result)}
        </span>
      </td>

      <td>${diceText}</td>

      <td>${totalText}</td>

      <td>${time}</td>

    `;

    tbody.appendChild(row);

  });
}


// =========================================================
// RENDER
// =========================================================

function render() {

  const counts =
    countResults(history);

  const total =
    history.length;

  // Stats

  document.getElementById("totalRounds")
    .textContent = total;

  document.getElementById("playerPercent")
    .textContent =
    percentage(counts.P, total) + "%";

  document.getElementById("bankerPercent")
    .textContent =
    percentage(counts.B, total) + "%";

  document.getElementById("tiePercent")
    .textContent =
    percentage(counts.T, total) + "%";

  document.getElementById("playerCount")
    .textContent =
    `${counts.P} rondas`;

  document.getElementById("bankerCount")
    .textContent =
    `${counts.B} rondas`;

  document.getElementById("tieCount")
    .textContent =
    `${counts.T} rondas`;


  // Signal

  const signalData =
    calculateSignal(
      history,
      getWindowSize(),
      getMinimumConfidence()
    );

  document.getElementById("signal")
    .textContent =
    signalData.signal;

  document.getElementById("confidence")
    .textContent =
    signalData.confidence + "%";

  document.getElementById("confidenceBar")
    .style.width =
    signalData.confidence + "%";

  document.getElementById("signalReason")
    .textContent =
    signalData.reason;


  // Current streak

  const streak =
    getCurrentStreak(history);

  document.getElementById("currentStreak")
    .textContent =
    streak.result === "—"
      ? "—"
      : resultName(streak.result);

  document.getElementById("currentStreakCount")
    .textContent =
    `${streak.count} ronda${streak.count === 1 ? "" : "s"}`;


  // Max streaks

  const max =
    getMaximumStreaks(history);

  document.getElementById("maxPlayer")
    .textContent = max.P;

  document.getElementById("maxBanker")
    .textContent = max.B;

  document.getElementById("maxTie")
    .textContent = max.T;


  // Recent

  document.getElementById("recent10")
    .textContent =
    formatWindow(10);

  document.getElementById("recent20")
    .textContent =
    formatWindow(20);

  document.getElementById("recent50")
    .textContent =
    formatWindow(50);


  // Visuals

  renderRoad();
  renderLast20();
  renderTable();
}


// =========================================================
// IMPORT
// =========================================================

function importHistory() {

  const input =
    document.getElementById("importFile");

  input.value = "";

  input.click();

  input.onchange = function () {

    const file = input.files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = function (event) {

      try {

        const imported =
          JSON.parse(event.target.result);

        if (!Array.isArray(imported)) {

          throw new Error("Formato inválido.");
        }

        const valid =
          imported.filter(item =>
            item &&
            ["P", "B", "T"].includes(item.result)
        );

        history = valid;

        saveHistory();
        render();

        alert(
          `${valid.length} rondas importadas com sucesso.`
        );

      } catch (error) {

        alert(
          "Não foi possível importar o histórico."
        );

        console.error(error);
      }
    };

    reader.readAsText(file);
  };
}


// =========================================================
// EXPORT
// =========================================================

function exportHistory() {

  if (!history.length) {

    alert(
      "Não existem rondas para exportar."
    );

    return;
  }

  const data =
    JSON.stringify(history, null, 2);

  const blob =
    new Blob(
      [data],
      {
        type: "application/json"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `bacbo-history-${Date.now()}.json`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


// =========================================================
// DELETE
// =========================================================

function deleteAll() {

  if (!history.length) {

    alert(
      "O histórico já está vazio."
    );

    return;
  }

  const confirmed =
    confirm(
      "Tem a certeza que pretende apagar todo o histórico?"
    );

  if (!confirmed) return;

  history = [];

  saveHistory();

  render();
}


// =========================================================
// BACKTEST
// =========================================================

function runBacktest() {

  const resultBox =
    document.getElementById("backtestResult");

  const windowSize =
    getWindowSize();

  const minimumConfidence =
    getMinimumConfidence();

  if (history.length <= windowSize) {

    resultBox.innerHTML =
      `É necessário ter mais de
      <span class="backtest-number">${windowSize}</span>
      rondas para executar o backtest.`;

    return;
  }

  let entries = 0;
  let wins = 0;
  let losses = 0;

  let playerEntries = 0;
  let playerWins = 0;

  let bankerEntries = 0;
  let bankerWins = 0;


  /*
    Walk-forward:

    Para cada ronda histórica,
    o modelo só utiliza os resultados
    anteriores à ronda testada.
  */

  for (
    let i = windowSize;
    i < history.length;
    i++
  ) {

    const previous =
      history.slice(0, i);

    const actual =
      history[i].result;

    const signal =
      calculateSignal(
        previous,
        windowSize,
        minimumConfidence
      );

    if (
      signal.signal !== "PLAYER" &&
      signal.signal !== "BANKER"
    ) {

      continue;
    }

    /*
      Tie não conta como vitória.
    */

    entries++;

    const predicted =
      signal.signal === "PLAYER"
        ? "P"
        : "B";

    if (predicted === "P") {

      playerEntries++;

    } else {

      bankerEntries++;
    }

    if (predicted === actual) {

      wins++;

      if (predicted === "P") {

        playerWins++;

      } else {

        bankerWins++;
      }

    } else {

      losses++;
    }
  }


  if (!entries) {

    resultBox.innerHTML =
      "O modelo não encontrou sinais suficientes para testar neste histórico.";

    return;
  }

  const accuracy =
    ((wins / entries) * 100).toFixed(1);

  const playerAccuracy =
    playerEntries
      ? ((playerWins / playerEntries) * 100).toFixed(1)
      : "0.0";

  const bankerAccuracy =
    bankerEntries
      ? ((bankerWins / bankerEntries) * 100).toFixed(1)
      : "0.0";


  resultBox.innerHTML = `

    <div>
      Entradas testadas:
      <span class="backtest-number">${entries}</span>
    </div>

    <div>
      Vitórias:
      <span class="backtest-number">${wins}</span>
    </div>

    <div>
      Derrotas:
      <span class="backtest-number">${losses}</span>
    </div>

    <div>
      Precisão histórica:
      <span class="backtest-number">${accuracy}%</span>
    </div>

    <div>
      Precisão Player:
      <span class="backtest-number">${playerAccuracy}%</span>
    </div>

    <div>
      Precisão Banker:
      <span class="backtest-number">${bankerAccuracy}%</span>
    </div>

    <br>

    <small>
      Estes valores descrevem apenas o desempenho
      histórico do modelo neste conjunto de dados.
      Não representam garantia de resultados futuros.
    </small>

  `;
}


// =========================================================
// KEYBOARD SHORTCUTS
// =========================================================

document.addEventListener(
  "keydown",
  function(event) {

    /*
      P = Player
      B = Banker
      T = Tie
    */

    if (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA"
    ) {
      return;
    }

    if (event.key.toLowerCase() === "p") {

      addResult("P");

    }

    if (event.key.toLowerCase() === "b") {

      addResult("B");

    }

    if (event.key.toLowerCase() === "t") {

      addResult("T");

    }

  }
);


// =========================================================
// START
// =========================================================

render();