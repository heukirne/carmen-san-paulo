const dom = {
  caseSelector: document.querySelector("#case-selector"),
  startCaseButton: document.querySelector("#start-case-btn"),
  statusText: document.querySelector("#status-text"),
  timeLeft: document.querySelector("#time-left"),
  currentLocation: document.querySelector("#current-location"),
  warrantStatus: document.querySelector("#warrant-status"),
  screenImage: document.querySelector("#screen-image"),
  speakerName: document.querySelector("#speaker-name"),
  dialogueBox: document.querySelector("#dialogue-box"),
  locationImage: document.querySelector("#location-image"),
  locationDescription: document.querySelector("#location-description"),
  eventLog: document.querySelector("#event-log"),
  identityLog: document.querySelector("#identity-log"),
  evidenceFields: document.querySelector("#evidence-fields"),
  actionButtons: Array.from(document.querySelectorAll("[data-action]")),
  travelButton: document.querySelector("#travel-btn"),
  warrantButton: document.querySelector("#warrant-btn"),
  runWarrantButton: document.querySelector("#run-warrant-btn"),
  captureButton: document.querySelector("#capture-btn"),
  travelModal: document.querySelector("#travel-modal"),
  travelHint: document.querySelector("#travel-hint"),
  travelOptions: document.querySelector("#travel-options"),
  closeTravelModal: document.querySelector("#close-travel-modal"),
  openAiKeyInput: document.querySelector("#openai-key"),
  openAiModelInput: document.querySelector("#openai-model"),
  openAiVoiceInput: document.querySelector("#openai-voice"),
  voiceEnabledInput: document.querySelector("#voice-enabled"),
  saveVoiceSettingsButton: document.querySelector("#save-voice-settings"),
  voiceStatus: document.querySelector("#voice-status")
};

const STORAGE_KEYS = {
  voice: "carmen.voice.settings.v1"
};

const app = {
  manifest: null,
  currentCase: null,
  suspectsData: null,
  locationsById: new Map(),
  state: null,
  fieldById: new Map(),
  voice: {
    enabled: false,
    apiKey: "",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    queue: Promise.resolve(),
    currentAudio: null
  }
};

boot().catch((error) => {
  console.error(error);
  setDialogue("Sistema", "Erro ao inicializar o jogo. Veja o console para detalhes.", "data/acme/chief.png");
});

async function boot() {
  attachEvents();
  loadVoiceSettings();

  app.manifest = await loadJson("data/cases-manifest.json");
  populateCaseSelector();

  const firstCase = app.manifest.cases[0];
  const initialCaseId = app.manifest.defaultCaseId || (firstCase ? firstCase.id : "");
  if (!initialCaseId) {
    throw new Error("Nenhum caso encontrado em data/cases-manifest.json");
  }

  await startCase(initialCaseId);
}

function attachEvents() {
  dom.startCaseButton.addEventListener("click", () => {
    startCase(dom.caseSelector.value).catch((error) => {
      console.error(error);
      appendEvent("Falha ao carregar caso.");
    });
  });

  dom.actionButtons.forEach((button) => {
    button.addEventListener("click", () => performAction(button.dataset.action));
  });

  dom.travelButton.addEventListener("click", openTravelModal);
  dom.closeTravelModal.addEventListener("click", closeTravelModal);
  dom.warrantButton.addEventListener("click", runWarrantCheck);
  dom.runWarrantButton.addEventListener("click", runWarrantCheck);
  dom.captureButton.addEventListener("click", attemptCapture);

  dom.travelModal.addEventListener("click", (event) => {
    if (event.target === dom.travelModal) {
      closeTravelModal();
    }
  });

  dom.saveVoiceSettingsButton.addEventListener("click", saveVoiceSettings);
}

async function startCase(caseId) {
  const caseEntry = app.manifest.cases.find((entry) => entry.id === caseId);
  if (!caseEntry) {
    throw new Error(`Caso nao encontrado: ${caseId}`);
  }

  const loadedCase = await loadJson(caseEntry.path);
  const suspectsData = await loadJson(loadedCase.suspectsData);

  app.currentCase = loadedCase;
  app.suspectsData = suspectsData;
  app.fieldById = new Map(suspectsData.fields.map((field) => [field.id, field]));
  app.locationsById = new Map(loadedCase.locations.map((location) => [location.id, location]));

  app.state = {
    status: "playing",
    hoursRemaining: loadedCase.settings.deadlineHours,
    routeIndex: 0,
    currentLocationId: loadedCase.route[0],
    usedActions: {},
    identityFindings: [],
    lastDestinationHint: "",
    warrant: {
      issued: false,
      suspectId: null,
      suspectName: ""
    }
  };

  for (const location of loadedCase.locations) {
    app.state.usedActions[location.id] = {
      witness: false,
      search: false,
      crimenet: false
    };
  }

  const backgroundPath = encodeURI(loadedCase.ui.backgroundImage);
  document.body.style.backgroundImage = `radial-gradient(circle at top left, #233f63 0%, #07111f 45%, #050b15 100%), url('${backgroundPath}')`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundBlendMode = "multiply";

  dom.eventLog.innerHTML = "";
  dom.identityLog.innerHTML = "";
  dom.travelOptions.innerHTML = "";

  createEvidenceFields();
  render();

  appendEvent(`Caso iniciado: ${loadedCase.title}`);
  setDialogue(loadedCase.briefing.speaker, loadedCase.briefing.text, loadedCase.briefing.image);
}

function populateCaseSelector() {
  dom.caseSelector.innerHTML = "";

  for (const entry of app.manifest.cases) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = `${entry.label} (${entry.language})`;
    if (entry.id === app.manifest.defaultCaseId) {
      option.selected = true;
    }
    dom.caseSelector.append(option);
  }
}

function createEvidenceFields() {
  dom.evidenceFields.innerHTML = "";

  for (const field of app.suspectsData.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "evidence-row";

    const label = document.createElement("label");
    label.setAttribute("for", `evidence-${field.id}`);
    label.textContent = field.label;

    const select = document.createElement("select");
    select.id = `evidence-${field.id}`;
    select.dataset.fieldId = field.id;

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- sem definicao --";
    select.append(emptyOption);

    for (const optionValue of field.options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue;
      select.append(option);
    }

    wrapper.append(label, select);
    dom.evidenceFields.append(wrapper);
  }
}

function render() {
  const location = getCurrentLocation();

  dom.statusText.textContent = readStatusText();
  dom.timeLeft.textContent = formatHours(app.state.hoursRemaining);
  dom.currentLocation.textContent = `${location.name}, ${location.country}`;
  dom.warrantStatus.textContent = app.state.warrant.issued
    ? `Emitido para ${app.state.warrant.suspectName}`
    : "Nao emitido";

  dom.locationImage.src = encodeURI(location.image || app.currentCase.ui.fallbackLocationImage);
  dom.locationDescription.textContent = location.description;

  const isPlaying = app.state.status === "playing";
  const isFinalStop = isAtFinalLocation();

  for (const button of dom.actionButtons) {
    const actionId = button.dataset.action;
    button.disabled = !isPlaying || app.state.usedActions[location.id][actionId];
  }

  dom.travelButton.disabled = !isPlaying || location.travelOptions.length === 0;
  dom.warrantButton.disabled = !isPlaying;
  dom.runWarrantButton.disabled = !isPlaying;
  dom.captureButton.disabled = !isPlaying || !isFinalStop;
}

function performAction(actionId) {
  if (!isPlaying()) {
    return;
  }

  const location = getCurrentLocation();
  const action = location.actions[actionId];

  if (!action) {
    appendEvent("Acao indisponivel neste local.");
    return;
  }

  if (app.state.usedActions[location.id][actionId]) {
    appendEvent("Essa acao ja foi utilizada neste local.");
    return;
  }

  const cost =
    app.currentCase.settings.actionCosts[actionId] !== undefined
      ? app.currentCase.settings.actionCosts[actionId]
      : 2;
  spendHours(cost, `Acao ${actionId}`);

  if (!isPlaying()) {
    render();
    return;
  }

  app.state.usedActions[location.id][actionId] = true;
  setDialogue(action.speaker || "Contato", action.text, location.image || app.currentCase.ui.fallbackLocationImage);
  appendEvent(`[${location.name}] ${action.speaker || "Contato"}: ${action.text}`);

  for (const reveal of action.reveals || []) {
    applyReveal(reveal);
  }

  render();
}

function applyReveal(reveal) {
  if (reveal.type === "destination") {
    const destinationId = reveal.value;
    const destinationLocation = app.locationsById.get(destinationId);
    const destinationText = destinationLocation
      ? `${destinationLocation.name}, ${destinationLocation.country}`
      : destinationId;

    app.state.lastDestinationHint = destinationText;
    appendEvent(`Pista de rota (${reveal.clueType}): ${destinationText}`);
    return;
  }

  if (reveal.type === "identity") {
    const field = app.fieldById.get(reveal.field);
    if (!field) {
      return;
    }

    const label = `${field.label}: ${reveal.value}`;
    app.state.identityFindings.push(label);

    const li = document.createElement("li");
    li.textContent = label;
    dom.identityLog.prepend(li);

    const select = document.querySelector(`#evidence-${reveal.field}`);
    if (select && !select.value) {
      select.value = reveal.value;
    }

    appendEvent(`Pista de identidade: ${label}`);
  }
}

function openTravelModal() {
  if (!isPlaying()) {
    return;
  }

  const location = getCurrentLocation();
  if (!location.travelOptions || location.travelOptions.length === 0) {
    appendEvent("Nao ha destinos de voo neste local.");
    return;
  }

  const hintText = app.state.lastDestinationHint
    ? `Ultima pista sugere: ${app.state.lastDestinationHint}`
    : "Sem pista direta. Analise seus registros antes de voar.";

  dom.travelHint.textContent = hintText;
  dom.travelOptions.innerHTML = "";

  for (const option of location.travelOptions) {
    const button = document.createElement("button");
    button.className = "btn";
    button.textContent = `${option.label} (${option.hours}h)`;
    button.addEventListener("click", () => travelTo(option));
    dom.travelOptions.append(button);
  }

  dom.travelModal.classList.remove("hidden");
  dom.travelModal.setAttribute("aria-hidden", "false");
}

function closeTravelModal() {
  dom.travelModal.classList.add("hidden");
  dom.travelModal.setAttribute("aria-hidden", "true");
}

function travelTo(option) {
  if (!isPlaying()) {
    return;
  }

  const currentLocation = getCurrentLocation();
  spendHours(option.hours || 5, `Voo para ${option.label}`);

  if (!isPlaying()) {
    closeTravelModal();
    render();
    return;
  }

  const expectedDestination = app.currentCase.route[app.state.routeIndex + 1];

  if (option.to === expectedDestination) {
    app.state.routeIndex += 1;
    app.state.currentLocationId = option.to;
    app.state.lastDestinationHint = "";

    const destination = getCurrentLocation();
    setDialogue("Controle de Voo", `Pouso confirmado em ${destination.name}. Continue a investigacao.`, app.currentCase.ui.travelImage);
    appendEvent(`Viagem correta para ${destination.name}.`);

    if (isAtFinalLocation()) {
      appendEvent("Voce chegou ao ultimo destino da rota. Emita o mandado e tente a captura.");
    }
  } else {
    setDialogue("Controle de Voo", currentLocation.wrongTravelText || "Rastro perdido. Destino incorreto.", app.currentCase.ui.travelImage);
    appendEvent(`Destino incorreto: ${option.label}. Tempo perdido.`);
  }

  closeTravelModal();
  render();
}

function runWarrantCheck() {
  if (!isPlaying()) {
    return;
  }

  spendHours(
    app.currentCase.settings.actionCosts.warrant !== undefined
      ? app.currentCase.settings.actionCosts.warrant
      : 2,
    "Emissao de mandado"
  );

  if (!isPlaying()) {
    render();
    return;
  }

  const selectedEvidence = getSelectedEvidence();
  const matches = app.suspectsData.suspects.filter((suspect) => {
    return Object.entries(selectedEvidence).every(([fieldId, value]) => suspect.attributes[fieldId] === value);
  });

  if (Object.keys(selectedEvidence).length < 2) {
    app.state.warrant.issued = false;
    app.state.warrant.suspectId = null;
    app.state.warrant.suspectName = "";
    setDialogue(
      "Warrant Robot",
      "Dados insuficientes. Colete mais pistas antes de emitir o mandado.",
      "data/acme/warrant_robot.png"
    );
    appendEvent("Mandado falhou: menos de 2 pistas preenchidas.");
    render();
    return;
  }

  if (matches.length === 1) {
    const selected = matches[0];
    app.state.warrant.issued = true;
    app.state.warrant.suspectId = selected.id;
    app.state.warrant.suspectName = selected.name;

    setDialogue("Warrant Robot", `Mandado emitido para ${selected.name}.`, "data/acme/warrant_robot.png");
    appendEvent(`Mandado emitido para ${selected.name}.`);
  } else if (matches.length > 1) {
    app.state.warrant.issued = false;
    app.state.warrant.suspectId = null;
    app.state.warrant.suspectName = "";

    const names = matches.map((item) => item.name).join(", ");
    setDialogue(
      "Warrant Robot",
      `Filtro ambiguo. Suspeitos possiveis: ${names}.`,
      "data/acme/warrant_robot.png"
    );
    appendEvent(`Mandado ambiguo: ${names}.`);
  } else {
    app.state.warrant.issued = false;
    app.state.warrant.suspectId = null;
    app.state.warrant.suspectName = "";

    setDialogue(
      "Warrant Robot",
      "Nenhum suspeito compativel encontrado com essas evidencias.",
      "data/acme/warrant_robot.png"
    );
    appendEvent("Mandado sem correspondencia.");
  }

  render();
}

function attemptCapture() {
  if (!isPlaying()) {
    return;
  }

  if (!isAtFinalLocation()) {
    appendEvent("Voce ainda nao alcancou o ultimo destino da rota.");
    return;
  }

  spendHours(
    app.currentCase.settings.actionCosts.capture !== undefined
      ? app.currentCase.settings.actionCosts.capture
      : 1,
    "Tentativa de captura"
  );

  if (!isPlaying()) {
    render();
    return;
  }

  if (!app.state.warrant.issued) {
    finishGame("lost", app.currentCase.ending.failNoWarrantText, app.currentCase.ui.captureImage);
    return;
  }

  if (app.state.warrant.suspectId !== app.currentCase.suspectId) {
    finishGame("lost", app.currentCase.ending.failWrongWarrantText, app.currentCase.ui.captureImage);
    return;
  }

  finishGame("won", app.currentCase.ending.successText, app.currentCase.ui.captureImage);
}

function finishGame(status, message, imagePath) {
  app.state.status = status;
  setDialogue("Sistema", message, imagePath || app.currentCase.ui.captureImage);
  appendEvent(message);
  render();
}

function spendHours(hours, reason) {
  app.state.hoursRemaining -= hours;
  appendEvent(`${reason}: -${hours}h.`);

  if (app.state.hoursRemaining <= 0 && app.state.status === "playing") {
    app.state.hoursRemaining = 0;
    finishGame("timeout", app.currentCase.ending.timeoutText, app.currentCase.ui.captureImage);
  }
}

function getSelectedEvidence() {
  const evidence = {};

  for (const field of app.suspectsData.fields) {
    const select = document.querySelector(`#evidence-${field.id}`);
    if (select && select.value) {
      evidence[field.id] = select.value;
    }
  }

  return evidence;
}

function getCurrentLocation() {
  const location = app.locationsById.get(app.state.currentLocationId);
  if (!location) {
    throw new Error(`Local desconhecido: ${app.state.currentLocationId}`);
  }
  return location;
}

function isAtFinalLocation() {
  return app.state.routeIndex === app.currentCase.route.length - 1;
}

function isPlaying() {
  return app.state && app.state.status === "playing";
}

function readStatusText() {
  if (!app.state) {
    return "Carregando";
  }

  if (app.state.status === "playing") {
    return "Em investigacao";
  }

  if (app.state.status === "won") {
    return "Caso resolvido";
  }

  if (app.state.status === "timeout") {
    return "Prazo encerrado";
  }

  return "Caso falhou";
}

function formatHours(totalHours) {
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${hours}h`;
}

function appendEvent(text) {
  const li = document.createElement("li");
  li.textContent = text;
  dom.eventLog.prepend(li);

  while (dom.eventLog.childElementCount > 60) {
    dom.eventLog.removeChild(dom.eventLog.lastElementChild);
  }
}

function setDialogue(speaker, text, imagePath) {
  dom.speakerName.textContent = speaker;
  dom.dialogueBox.textContent = text;

  if (imagePath) {
    dom.screenImage.src = encodeURI(imagePath);
  }

  queueVoice(text);
}

function loadVoiceSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.voice);
  if (!raw) {
    syncVoiceForm();
    setVoiceStatus("Modo texto ativo. Voz OpenAI desativada.");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    app.voice.enabled = Boolean(parsed.enabled);
    app.voice.apiKey = parsed.apiKey || "";
    app.voice.model = parsed.model || "gpt-4o-mini-tts";
    app.voice.voice = parsed.voice || "alloy";
  } catch (error) {
    app.voice.enabled = false;
    app.voice.apiKey = "";
  }

  syncVoiceForm();

  if (app.voice.enabled && app.voice.apiKey) {
    setVoiceStatus("Voz OpenAI ativa.");
  } else {
    setVoiceStatus("Modo texto ativo. Configure API key para voz.");
  }
}

function saveVoiceSettings() {
  app.voice.enabled = dom.voiceEnabledInput.checked;
  app.voice.apiKey = dom.openAiKeyInput.value.trim();
  app.voice.model = dom.openAiModelInput.value.trim() || "gpt-4o-mini-tts";
  app.voice.voice = dom.openAiVoiceInput.value;

  localStorage.setItem(
    STORAGE_KEYS.voice,
    JSON.stringify({
      enabled: app.voice.enabled,
      apiKey: app.voice.apiKey,
      model: app.voice.model,
      voice: app.voice.voice
    })
  );

  if (app.voice.enabled && !app.voice.apiKey) {
    setVoiceStatus("Voz marcada como ativa, mas sem API key. Fica em texto.");
    return;
  }

  if (app.voice.enabled) {
    setVoiceStatus("Configuracao salva. Voz OpenAI pronta para os proximos dialogos.");
  } else {
    setVoiceStatus("Configuracao salva. Modo texto ativo.");
  }
}

function syncVoiceForm() {
  dom.voiceEnabledInput.checked = app.voice.enabled;
  dom.openAiKeyInput.value = app.voice.apiKey;
  dom.openAiModelInput.value = app.voice.model;
  dom.openAiVoiceInput.value = app.voice.voice;
}

function setVoiceStatus(text) {
  dom.voiceStatus.textContent = text;
}

function queueVoice(text) {
  if (!app.voice.enabled || !app.voice.apiKey) {
    return;
  }

  app.voice.queue = app.voice.queue
    .then(() => speakWithOpenAI(text))
    .catch((error) => {
      console.error(error);
      setVoiceStatus("Falha ao gerar audio OpenAI. Mantendo dialogo em texto.");
    });
}

async function speakWithOpenAI(text) {
  if (!text) {
    return;
  }

  if (app.voice.currentAudio) {
    app.voice.currentAudio.pause();
    app.voice.currentAudio = null;
  }

  const endpoint = "https://api.openai.com/v1/audio/speech";
  const payload = {
    model: app.voice.model || "gpt-4o-mini-tts",
    voice: app.voice.voice || "alloy",
    input: text,
    response_format: "mp3"
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${app.voice.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI TTS falhou (${response.status}): ${body}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  await new Promise((resolve, reject) => {
    const audio = new Audio(objectUrl);
    app.voice.currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(objectUrl);
      resolve();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Nao foi possivel reproduzir o audio."));
    };

    audio.play().catch(reject);
  });
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path} (${response.status})`);
  }

  return response.json();
}
