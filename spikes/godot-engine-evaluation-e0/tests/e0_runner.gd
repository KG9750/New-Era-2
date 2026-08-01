extends SceneTree

const DEFAULT_SCENE := "res://scenes/E0.tscn"

var fixture_id := "nominal"
var output_path := ""
var vector := "success"
var expected_total := -1


func _initialize() -> void:
	_parse_args()
	call_deferred("_run")


func _parse_args() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--fixture="):
			fixture_id = arg.trim_prefix("--fixture=")
		elif arg.begins_with("--output="):
			output_path = arg.trim_prefix("--output=")
		elif arg.begins_with("--vector="):
			vector = arg.trim_prefix("--vector=")
		elif arg.begins_with("--expected-total="):
			expected_total = int(arg.trim_prefix("--expected-total="))


func _run() -> void:
	var scene_path := DEFAULT_SCENE
	if vector == "missing-scene":
		scene_path = "res://scenes/ABSENT.tscn"
	elif vector == "bad-type":
		scene_path = "res://tests/not_scene.tres"

	if not ResourceLoader.exists(scene_path):
		_fail(21, "RESOURCE_ABSENT", {"scenePath": scene_path})
		return
	var resource := ResourceLoader.load(scene_path)
	if not (resource is PackedScene):
		_fail(22, "RESOURCE_NOT_PACKED_SCENE", {"scenePath": scene_path, "type": resource.get_class()})
		return
	var instance := (resource as PackedScene).instantiate()
	if instance == null:
		_fail(24, "SCENE_INSTANTIATE_FAILED", {"scenePath": scene_path})
		return
	get_root().add_child(instance)
	await process_frame
	if not instance.has_method("get_fixture_manifest"):
		_fail(25, "FIXTURE_MANIFEST_METHOD_ABSENT", {})
		return
	var manifest: Dictionary = instance.call("get_fixture_manifest")
	if expected_total >= 0 and manifest["totalCellCount"] != expected_total:
		_fail(23, "FIXTURE_TOTAL_MISMATCH", {"expected": expected_total, "actual": manifest["totalCellCount"]})
		return
	var result := {
		"status": "PASS",
		"vector": vector,
		"scenePath": scene_path,
		"fixtureId": fixture_id,
		"manifest": manifest,
		"nodeTree": _node_tree(instance),
	}
	_write_result(result)
	print("E0_RUNNER_PASS=" + JSON.stringify(result))
	quit(0)


func _node_tree(node: Node) -> Dictionary:
	var children: Array[Dictionary] = []
	for child in node.get_children():
		children.append(_node_tree(child))
	return {"name": String(node.name), "type": node.get_class(), "path": String(node.get_path()), "children": children}


func _fail(code: int, error_code: String, details: Dictionary) -> void:
	var result := {"status": "EXPECTED_FAILURE", "errorCode": error_code, "details": details, "vector": vector}
	_write_result(result)
	printerr("E0_RUNNER_FAIL=" + JSON.stringify(result))
	quit(code)


func _write_result(value: Variant) -> void:
	if output_path == "":
		return
	var file := FileAccess.open(output_path, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify(value, "\t") + "\n")
	file.close()
