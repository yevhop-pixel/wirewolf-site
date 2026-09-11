import { createInitialState, reduceDemo } from "./panel-demo-model.mjs"

const root = document.querySelector("#room-demo")

if (root) {
  const get = id => document.getElementById(id)
  const routeButtons = [...root.querySelectorAll("button[data-route][data-source]")]
  const outputs = { a: get("display-a"), b: get("display-b"), audio: get("audio-source") }
  const names = { a: "Display A", b: "Display B", audio: "Room audio" }
  const volume = get("demo-volume")
  const mute = get("demo-mute")
  const power = get("demo-power")
  const reset = get("demo-reset")
  const offline = get("demo-offline")
  const dialog = get("shutdown-dialog")
  const timers = new Map()
  let state = createInitialState()
  let returnAfterPower = false

  function announce(message) {
    get("demo-status").textContent = message
  }

  function render() {
    const powerPending = state.pending.power
    const on = state.power === "on"
    root.dataset.power = powerPending ? "pending" : state.power
    get("room-state").textContent = powerPending
      ? (powerPending.power === "on" ? "Starting room..." : "Ending session...")
      : (on ? "Room on" : "Room off")
    for (const [target, output] of Object.entries(outputs)) {
      const request = state.pending[target]
      const unavailable = target === "b" && state.offline
      output.textContent = unavailable ? "Unavailable"
        : powerPending ? (powerPending.power === "on" ? "Starting..." : "Turning off...")
        : !on ? "Off"
        : request ? "Switching to " + request.source + "..."
        : state.routes[target]
      output.setAttribute("aria-busy", String(!unavailable && Boolean(request || powerPending)))
    }
    for (const button of routeButtons) {
      const target = button.dataset.route
      const unavailable = target === "b" && state.offline
      button.disabled = !on || Boolean(powerPending || state.pending[target]) || unavailable
      button.setAttribute("aria-pressed", String(on && !unavailable &&
        state.routes[target] === button.dataset.source))
    }
    volume.value = String(state.volume)
    volume.disabled = !on || Boolean(powerPending || state.pending.audio)
    get("volume-value").textContent = state.volume + "%"
    mute.disabled = volume.disabled
    mute.setAttribute("aria-pressed", String(state.muted))
    mute.setAttribute("aria-label", "Mute room audio")
    mute.textContent = state.muted ? "Muted" : "Mute audio"
    power.disabled = Boolean(powerPending)
    power.textContent = powerPending ? (powerPending.power === "on" ? "Starting..." : "Ending...")
      : on ? "End session" : "Start room"
    offline.checked = state.offline
    offline.disabled = Boolean(powerPending)
    reset.disabled = false
  }

  function synchronizeTimers() {
    const active = new Set(Object.values(state.pending).map(request => request.id))
    for (const [id, timer] of timers) {
      if (!active.has(id)) {
        clearTimeout(timer)
        timers.delete(id)
      }
    }
    for (const [target, request] of Object.entries(state.pending)) {
      if (timers.has(request.id)) continue
      timers.set(request.id, setTimeout(() => {
        timers.delete(request.id)
        const previous = state
        state = reduceDemo(state, { type: "complete", target, id: request.id })
        if (state === previous) return
        render()
        if (target === "power") {
          announce(state.power === "on"
            ? "Simulated room started." + (state.offline ? " Display B remains unavailable." : "")
            : "Simulated session ended. Routes cleared and audio muted." +
              (state.offline ? " Display B remains unavailable." : ""))
          if (returnAfterPower && document.activeElement === reset) power.focus()
          returnAfterPower = false
        } else {
          announce(names[target] + " now uses " + state.routes[target] + ". Simulated feedback received.")
        }
      }, 600))
    }
  }

  function dispatch(action, message) {
    const next = reduceDemo(state, action)
    if (next === state) return
    state = next
    synchronizeTimers()
    render()
    if (message) announce(message)
  }

  for (const button of routeButtons) {
    button.addEventListener("click", () => {
      dispatch({ type: "route", target: button.dataset.route, source: button.dataset.source },
        names[button.dataset.route] + ": requesting " + button.dataset.source + ". Waiting for simulated feedback.")
    })
  }
  volume.addEventListener("input", () => {
    dispatch({ type: "volume", volume: Number(volume.value) })
  })
  volume.addEventListener("change", () => {
    announce("Simulated volume " + state.volume + "%" + (state.muted ? ", muted." : "."))
  })
  mute.addEventListener("click", () => {
    dispatch({ type: "mute" })
    announce(state.muted ? "Simulated room audio muted." : "Simulated room audio unmuted.")
  })
  offline.addEventListener("change", () => {
    const cancelled = Boolean(state.pending.b)
    dispatch({ type: "offline", offline: offline.checked }, offline.checked
      ? "Display B is unavailable." + (cancelled ? " Its pending request was cancelled." : "") +
        (state.power === "on" ? " Other room controls remain available." : " The room remains off.")
      : "Display B is available again" + (state.power === "off" ? ", powered off." : "."))
  })
  power.addEventListener("click", () => {
    if (state.pending.power) return
    if (state.power === "off") {
      dispatch({ type: "power", power: "on" }, "Starting the simulated room. Waiting for feedback.")
    } else {
      dialog.showModal()
      get("shutdown-cancel").focus()
    }
  })
  get("shutdown-cancel").addEventListener("click", () => dialog.close("cancel"))
  dialog.addEventListener("cancel", event => {
    event.preventDefault()
    dialog.close("cancel")
  })
  get("shutdown-confirm").addEventListener("click", () => {
    dialog.close("confirm")
    returnAfterPower = true
    dispatch({ type: "power", power: "off" }, "Ending the simulated session. Pending source requests cancelled.")
  })
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "confirm") announce("End session cancelled. Room settings kept.")
    if (power.disabled) reset.focus()
    else power.focus()
  })
  reset.addEventListener("click", () => {
    returnAfterPower = false
    dispatch({ type: "reset" }, "Demo reset. Room on, Display A Laptop, Display B Room PC, audio Laptop at 35%, unmuted.")
  })

  render()
  get("shutdown-cancel").disabled = false
  get("shutdown-confirm").disabled = false
  get("demo-ready").hidden = false
  get("demo-help").textContent = "Choose a source for each display or room audio. Feedback takes about half a second. Try Display B unavailable, end the session, or reset the demo."
  announce("Simulation ready. No real equipment connected and no sound plays.")
}
