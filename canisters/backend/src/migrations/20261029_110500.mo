import Array "mo:core/Array";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  type Visibility = { #controllers; #public_; #allowed_viewers : [Principal] };
  type OldSettings = {
    controllers : [Principal]; compute_allocation : Nat; memory_allocation : Nat;
    freezing_threshold : Nat; reserved_cycles_limit : Nat;
    wasm_memory_limit : ?Nat; wasm_memory_threshold : ?Nat; log_visibility : ?Visibility;
  };
  type NewSettings = OldSettings and {
    status_visibility : ?Visibility; snapshot_visibility : ?Visibility; log_memory_limit : ?Nat;
  };
  type Memory = {
    wasm_memory_size : Nat; stable_memory_size : Nat; global_memory_size : Nat;
    wasm_binary_size : Nat; custom_sections_size : Nat; canister_history_size : Nat;
    wasm_chunk_store_size : Nat; snapshots_size : Nat;
  };
  type StatusBase = {
    status : { #running; #stopping; #stopped };
    module_hash : ?Blob; memory_size : Nat; cycles : Nat; reserved_cycles : Nat;
    idle_cycles_burned_per_day : Nat;
    query_stats : {
      num_calls_total : Nat; num_instructions_total : Nat;
      request_payload_bytes_total : Nat; response_payload_bytes_total : Nat;
    };
  };
  type OldStatus = StatusBase and { settings : OldSettings; memory_metrics : ?Memory };
  type NewStatus = StatusBase and {
    settings : NewSettings;
    memory_metrics : ?(Memory and { log_memory_store_size : ?Nat });
    version : ?Nat64; ready_for_migration : ?Bool;
  };
  type EntryBase = {
    id : Principal; name : Text; addedAt : Int; lastAttempt : Int;
    history : [{ at : Int; cycles : Nat }]; lastError : ?Text;
  };
  type OldEntry = EntryBase and { snapshot : ?{ at : Int; details : OldStatus } };
  type NewEntry = EntryBase and { snapshot : ?{ at : Int; details : NewStatus } };
  type OldActor = { accounts : Map.Map<Principal, { entries : [OldEntry]; lastRequest : Int }> };
  type NewActor = { accounts : Map.Map<Principal, { entries : [NewEntry]; lastRequest : Int }> };

  public func migration(old : OldActor) : NewActor {
    let accounts = Map.empty<Principal, { entries : [NewEntry]; lastRequest : Int }>();
    for ((owner, account) in old.accounts.entries()) {
      let entries = account.entries.map<OldEntry, NewEntry>(func entry = {
        entry with snapshot = switch (entry.snapshot) {
          case null null;
          case (?snapshot) ?{
            snapshot with details = {
              snapshot.details with
              version = null; ready_for_migration = null;
              settings = {
                snapshot.details.settings with
                status_visibility = null; snapshot_visibility = null; log_memory_limit = null;
              };
              memory_metrics = switch (snapshot.details.memory_metrics) {
                case null null;
                case (?memory) ?{ memory with log_memory_store_size = null };
              };
            };
          };
        };
      });
      accounts.add(owner, { account with entries });
    };
    { accounts }
  };
};
