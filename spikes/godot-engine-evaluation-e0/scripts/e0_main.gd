extends Node2D

const TILE_SIZE := Vector2i(16, 16)
const ATLAS_SIZE := Vector2i(48, 16)
const SOURCE_ID := 0
const CAMERA_STEP := 64.0
const WARMUP_FRAMES := 120
const SAMPLE_SECONDS := 10.0
const MINIMUM_SAMPLE_FRAMES := 120
const ACTIONS := {
	"e0_camera_right": Vector2(CAMERA_STEP, 0.0),
	"e0_camera_down": Vector2(0.0, CAMERA_STEP),
	"e0_camera_left": Vector2(-CAMERA_STEP, 0.0),
	"e0_camera_up": Vector2(0.0, -CAMERA_STEP),
}

var fixture_id := "nominal"
var mode := "interactive"
var output_path := ""
var grid := Vector2i(64, 36)
var expected_counts := {"Ground": 2304, "Detail": 576, "Overlay": 144}
var layers: Array[TileMapLayer] = []
var camera: Camera2D
var fixture_manifest: Dictionary = {}
var input_events: Array[Dictionary] = []
var input_sequence := 0
var valid_action_count := 0
var input_start_usec := 0
var input_last_event_usec := 0
var input_finished := false
var warmup_frame_count := 0
var sample_start_ns := 0
var samples: Array[Dictionary] = []
var performance_finished := false


func _ready() -> void:
	_parse_user_args()
	_configure_fixture()
	_build_fixture()
	fixture_manifest = _make_fixture_manifest()
	print("E0_FIXTURE_MANIFEST=" + JSON.stringify(fixture_manifest))
	if not _fixture_matches_contract():
		printerr("E0_FIXTURE_COUNT_MISMATCH")
		get_tree().quit(31)
		return
	if mode == "smoke":
		call_deferred("_finish_smoke")
	elif mode == "input":
		input_start_usec = Time.get_ticks_usec()


func _process(_delta: float) -> void:
	if mode == "performance" and not performance_finished:
		_sample_performance()
	elif mode == "input" and not input_finished:
		_poll_input_completion()


func _input(event: InputEvent) -> void:
	if mode != "input" or not (event is InputEventKey):
		return
	_observe_key_event(event as InputEventKey)


func _parse_user_args() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--fixture="):
			fixture_id = arg.trim_prefix("--fixture=")
		elif arg.begins_with("--mode="):
			mode = arg.trim_prefix("--mode=")
		elif arg.begins_with("--output="):
			output_path = arg.trim_prefix("--output=")


func _configure_fixture() -> void:
	if fixture_id == "stress":
		grid = Vector2i(256, 144)
		expected_counts = {"Ground": 36864, "Detail": 9216, "Overlay": 2304}
	elif fixture_id != "nominal":
		printerr("E0_UNKNOWN_FIXTURE=" + fixture_id)
		get_tree().quit(30)


func _build_fixture() -> void:
	var tile_set := TileSet.new()
	tile_set.tile_size = TILE_SIZE
	var atlas_image := Image.create_empty(ATLAS_SIZE.x, ATLAS_SIZE.y, false, Image.FORMAT_RGBA8)
	var colors := [Color("566b4f"), Color("9a8f62"), Color("5f718c")]
	for tile_x in range(3):
		for pixel_y in range(TILE_SIZE.y):
			for pixel_x in range(TILE_SIZE.x):
				atlas_image.set_pixel(tile_x * TILE_SIZE.x + pixel_x, pixel_y, colors[tile_x])
	var atlas_source := TileSetAtlasSource.new()
	atlas_source.texture = ImageTexture.create_from_image(atlas_image)
	atlas_source.texture_region_size = TILE_SIZE
	for tile_x in range(3):
		atlas_source.create_tile(Vector2i(tile_x, 0))
	tile_set.add_source(atlas_source, SOURCE_ID)

	for layer_name in ["Ground", "Detail", "Overlay"]:
		var layer := TileMapLayer.new()
		layer.name = layer_name
		layer.tile_set = tile_set
		layer.position = Vector2(-grid.x * TILE_SIZE.x / 2.0, -grid.y * TILE_SIZE.y / 2.0)
		add_child(layer)
		layers.append(layer)

	for y in range(grid.y):
		for x in range(grid.x):
			var cell := Vector2i(x, y)
			layers[0].set_cell(cell, SOURCE_ID, Vector2i(0, 0), 0)
			if (x + 2 * y) % 4 == 0:
				layers[1].set_cell(cell, SOURCE_ID, Vector2i(1, 0), 0)
			if (3 * x + y) % 16 == 0:
				layers[2].set_cell(cell, SOURCE_ID, Vector2i(2, 0), 0)

	camera = Camera2D.new()
	camera.name = "E0Camera"
	camera.position = Vector2.ZERO
	camera.position_smoothing_enabled = false
	camera.drag_horizontal_enabled = false
	camera.drag_vertical_enabled = false
	add_child(camera)
	camera.make_current()
	camera.force_update_scroll()


func _make_fixture_manifest() -> Dictionary:
	var layer_rows: Array[Dictionary] = []
	var total := 0
	for layer in layers:
		var count := layer.get_used_cells().size()
		var rect := layer.get_used_rect()
		total += count
		layer_rows.append({
			"name": String(layer.name),
			"cellCount": count,
			"usedRect": [rect.position.x, rect.position.y, rect.size.x, rect.size.y],
		})
	return {
		"fixtureId": fixture_id,
		"grid": [grid.x, grid.y],
		"layers": layer_rows,
		"totalCellCount": total,
		"cameraCurrent": camera.is_current(),
		"cameraCenter": [camera.get_screen_center_position().x, camera.get_screen_center_position().y],
		"displayServer": DisplayServer.get_name(),
		"windowSize": [get_window().size.x, get_window().size.y],
		"visibleRect": _rect_to_array(get_viewport().get_visible_rect()),
	}


func _fixture_matches_contract() -> bool:
	if fixture_manifest["grid"] != [grid.x, grid.y]:
		return false
	var total_expected := 0
	for row in fixture_manifest["layers"]:
		var name: String = row["name"]
		if row["cellCount"] != expected_counts[name]:
			return false
		total_expected += expected_counts[name]
	return fixture_manifest["totalCellCount"] == total_expected


func get_fixture_manifest() -> Dictionary:
	return fixture_manifest.duplicate(true)


func _finish_smoke() -> void:
	await get_tree().process_frame
	_write_json({"status": "PASS", "mode": "smoke", "fixture": _make_fixture_manifest()})
	get_tree().quit(0)


func _observe_key_event(event: InputEventKey) -> void:
	input_sequence += 1
	input_last_event_usec = Time.get_ticks_usec()
	var action := _resolve_action(event)
	var before := camera.get_screen_center_position()
	if event.pressed and not event.echo and action != "":
		camera.position += ACTIONS[action]
		valid_action_count += 1
		camera.force_update_scroll()
	var row := {
		"sequence": input_sequence,
		"pressed": event.pressed,
		"echo": event.echo,
		"keycode": int(event.keycode),
		"physicalKeycode": int(event.physical_keycode),
		"resolvedAction": action,
		"beforeCenter": [before.x, before.y],
		"afterCenter": [],
	}
	await get_tree().process_frame
	var after := camera.get_screen_center_position()
	row["afterCenter"] = [after.x, after.y]
	input_events.append(row)
	print("E0_INPUT_EVENT=" + JSON.stringify(row))


func _resolve_action(event: InputEventKey) -> String:
	for action in ACTIONS.keys():
		if event.is_action(action):
			return action
	return ""


func _poll_input_completion() -> void:
	var now_usec := Time.get_ticks_usec()
	if valid_action_count >= 4 and input_events.size() >= 8 and now_usec - input_last_event_usec >= 500000:
		input_finished = true
		var result := {
			"status": "CAPTURED",
			"inputProvenance": "OS_INJECTED_INPUT",
			"fixture": _make_fixture_manifest(),
			"validActionCount": valid_action_count,
			"events": input_events,
		}
		_write_json(result)
		get_tree().quit(0)
	elif now_usec - input_start_usec > 8000000:
		input_finished = true
		_write_json({
			"status": "INPUT_DELIVERY_TIMEOUT",
			"inputProvenance": "OS_INJECTED_INPUT",
			"validActionCount": valid_action_count,
			"events": input_events,
		})
		get_tree().quit(3)


func _sample_performance() -> void:
	if warmup_frame_count < WARMUP_FRAMES:
		warmup_frame_count += 1
		return
	var now_ns := Time.get_ticks_usec() * 1000
	if sample_start_ns == 0:
		sample_start_ns = now_ns
	var elapsed := float(now_ns - sample_start_ns) / 1000000000.0
	if elapsed < SAMPLE_SECONDS:
		samples.append({
			"frameIndex": Engine.get_process_frames(),
			"monotonicTimestampNs": now_ns,
			"elapsedSeconds": elapsed,
			"TIME_FPS": Performance.get_monitor(Performance.TIME_FPS),
			"TIME_PROCESS": Performance.get_monitor(Performance.TIME_PROCESS),
			"TIME_PHYSICS_PROCESS": Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS),
			"MEMORY_STATIC": Performance.get_monitor(Performance.MEMORY_STATIC),
			"OBJECT_NODE_COUNT": Performance.get_monitor(Performance.OBJECT_NODE_COUNT),
			"RENDER_TOTAL_OBJECTS_IN_FRAME": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
			"RENDER_TOTAL_DRAW_CALLS_IN_FRAME": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
			"RENDER_VIDEO_MEM_USED": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED),
		})
	else:
		performance_finished = true
		var result := {
			"status": "CAPTURED" if samples.size() >= MINIMUM_SAMPLE_FRAMES else "INSUFFICIENT_SAMPLES",
			"fixture": _make_fixture_manifest(),
			"warmupFrames": warmup_frame_count,
			"timedSampleSeconds": SAMPLE_SECONDS,
			"minimumSampleFrames": MINIMUM_SAMPLE_FRAMES,
			"sampleCount": samples.size(),
			"samples": samples,
		}
		_write_json(result)
		get_tree().quit(0 if samples.size() >= MINIMUM_SAMPLE_FRAMES else 4)


func _write_json(value: Variant) -> void:
	if output_path == "":
		printerr("E0_OUTPUT_PATH_UNSET")
		return
	var file := FileAccess.open(output_path, FileAccess.WRITE)
	if file == null:
		printerr("E0_OUTPUT_OPEN_FAILED=" + output_path)
		return
	file.store_string(JSON.stringify(value, "\t") + "\n")
	file.close()


func _rect_to_array(rect: Rect2) -> Array:
	return [rect.position.x, rect.position.y, rect.size.x, rect.size.y]
