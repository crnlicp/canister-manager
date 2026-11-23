import Map "mo:core/Map";

module {
  public type Visibility = { #controllers; #public_; #allowed_viewers : [Principal] };
  public type Settings = {
    controllers : [Principal];
    compute_allocation : Nat;
    memory_allocation : Nat;
    freezing_threshold : Nat;
    reserved_cycles_limit : Nat;
    wasm_memory_limit : ?Nat;
    wasm_memory_threshold : ?Nat;
    log_visibility : ?Visibility;
    status_visibility : ?Visibility;
    snapshot_visibility : ?Visibility;
    log_memory_limit : ?Nat;
  };
  public type Status = {
    status : { #running; #stopping; #stopped };
    version : ?Nat64;
    ready_for_migration : ?Bool;
    settings : Settings;
    module_hash : ?Blob;
    memory_size : Nat;
    cycles : Nat;
    reserved_cycles : Nat;
    idle_cycles_burned_per_day : Nat;
    query_stats : {
      num_calls_total : Nat;
      num_instructions_total : Nat;
      request_payload_bytes_total : Nat;
      response_payload_bytes_total : Nat;
    };
    memory_metrics : ?{
      wasm_memory_size : Nat;
      stable_memory_size : Nat;
      global_memory_size : Nat;
      wasm_binary_size : Nat;
      custom_sections_size : Nat;
      canister_history_size : Nat;
      wasm_chunk_store_size : Nat;
      snapshots_size : Nat;
      log_memory_store_size : ?Nat;
    };
  };
  public type Point = { at : Int; cycles : Nat };
  public type Snapshot = { at : Int; details : Status };
  public type Entry = {
    id : Principal;
    name : Text;
    addedAt : Int;
    lastAttempt : Int;
    snapshot : ?Snapshot;
    history : [Point];
    lastError : ?Text;
  };
  public type Account = { entries : [Entry]; lastRequest : Int };
  public type State = Map.Map<Principal, Account>;
  public type Project = { id : Nat; name : Text; canisterIds : [Principal] };
  public type ProjectAccount = { projects : [Project]; nextId : Nat };
  public type ProjectsState = Map.Map<Principal, ProjectAccount>;
  public type Result<T> = { #ok : T; #err : Text };
}
