import Principal "mo:core/Principal";
import Types "../src/backend/types";
import Watchlist "../src/backend/lib/watchlist";

let owner = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");
let viewer = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");
let stranger = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai");
let settings : Types.Settings = {
  controllers = [owner];
  compute_allocation = 0; memory_allocation = 0; freezing_threshold = 0;
  reserved_cycles_limit = 0; wasm_memory_limit = null; wasm_memory_threshold = null;
  log_visibility = null; status_visibility = null; snapshot_visibility = null;
  log_memory_limit = null;
};

assert Watchlist.canRead(settings, owner);
assert not Watchlist.canRead(settings, stranger);
assert Watchlist.canRead({ settings with status_visibility = ?#public_ }, stranger);
assert Watchlist.canRead({ settings with status_visibility = ?#allowed_viewers([viewer]) }, viewer);
assert Watchlist.canRead({ settings with status_visibility = ?#allowed_viewers([viewer]) }, owner);
assert not Watchlist.canRead({ settings with status_visibility = ?#allowed_viewers([viewer]) }, stranger);
assert not Watchlist.canRead({ settings with status_visibility = ?#controllers }, viewer);

var history : [Types.Point] = [];
var i = 0;
while (i < 65) {
  history := Watchlist.append(history, { at = i; cycles = i });
  i += 1;
};
assert history.size() == 60;
assert history[0].cycles == 5;
assert history[59].cycles == 64;

let entry : Types.Entry = {
  id = owner; name = "First"; addedAt = 0; lastAttempt = 0;
  snapshot = null; history = []; lastError = null;
};
let other = { entry with id = viewer; name = "Other" };
let replaced = Watchlist.replace([entry, other], { entry with name = "Updated" });
assert replaced.size() == 2;
assert replaced[0].name == "Updated";
assert replaced[1].name == "Other";
assert Watchlist.find(replaced, stranger) == null;
assert Watchlist.find(replaced, owner) == ?{ entry with name = "Updated" };
