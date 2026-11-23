import Array "mo:core/Array";
import Error "mo:core/Error";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Types "../types";
import Watchlist "../lib/watchlist";

mixin (accounts : Types.State, projectAccounts : Types.ProjectsState, backendId : Principal) {
  transient let management = actor ("aaaaa-aa") : actor {
    canister_status : shared { canister_id : Principal } -> async Types.Status;
  };
  transient var windowStart : Int = 0;
  transient var windowCalls = 0;
  transient var activeCalls = 0;

  func authenticate(caller : Principal) {
    if (caller.isAnonymous()) Runtime.trap("Sign in with Internet Identity to use your watchlist.");
  };

  func account(caller : Principal) : Types.Account {
    accounts.get(caller) ?? ({ entries = []; lastRequest = 0 })
  };

  func projectAccount(caller : Principal) : Types.ProjectAccount {
    projectAccounts.get(caller) ?? ({ projects = []; nextId = 0 })
  };

  func moveToProject(caller : Principal, id : Principal, projectId : ?Nat) {
    let current = projectAccount(caller);
    let projects = current.projects.map(func project = {
      project with canisterIds = if (?project.id == projectId) {
        project.canisterIds.filter(func existing = existing != id).concat([id])
      } else {
        project.canisterIds.filter(func existing = existing != id)
      };
    });
    projectAccounts.add(caller, { current with projects });
  };

  public shared query ({ caller }) func listProjects() : async [Types.Project] {
    authenticate(caller);
    projectAccount(caller).projects
  };

  public shared ({ caller }) func createProject(name : Text) : async Types.Result<Nat> {
    authenticate(caller);
    if (name.trim(#predicate(func char = char == ' ' or char == '\n' or char == '\t')).size() == 0 or name.size() > 80) return #err("Project name must contain 1 to 80 characters.");
    let current = projectAccount(caller);
    if (current.projects.size() >= 20) return #err("Your workspace is limited to 20 projects.");
    if (current.projects.any(func project = project.name == name)) return #err("A project with this name already exists.");
    if (accounts.get(caller) == null) {
      if (accounts.size() >= 100) return #err("This deployment has reached its 100-account capacity.");
      accounts.add(caller, account(caller));
    };
    let id = current.nextId;
    projectAccounts.add(caller, {
      nextId = id + 1;
      projects = current.projects.concat([{ id; name; canisterIds = [] }]);
    });
    #ok(id)
  };

  public shared ({ caller }) func renameProject(id : Nat, name : Text) : async Types.Result<()> {
    authenticate(caller);
    if (name.trim(#predicate(func char = char == ' ' or char == '\n' or char == '\t')).size() == 0 or name.size() > 80) return #err("Project name must contain 1 to 80 characters.");
    let current = projectAccount(caller);
    if (not current.projects.any(func project = project.id == id)) return #err("Project not found.");
    if (current.projects.any(func project = project.id != id and project.name == name)) return #err("A project with this name already exists.");
    projectAccounts.add(caller, { current with projects = current.projects.map(func project = if (project.id == id) ({ project with name }) else project) });
    #ok(())
  };

  public shared ({ caller }) func deleteProject(id : Nat) : async Types.Result<()> {
    authenticate(caller);
    let current = projectAccount(caller);
    if (not current.projects.any(func project = project.id == id)) return #err("Project not found.");
    projectAccounts.add(caller, { current with projects = current.projects.filter(func project = project.id != id) });
    #ok(())
  };

  public shared ({ caller }) func assignCanister(id : Principal, projectId : ?Nat) : async Types.Result<()> {
    authenticate(caller);
    if (Watchlist.find(account(caller).entries, id) == null) return #err("Canister not found.");
    switch (projectId) {
      case (?target) {
        if (not projectAccount(caller).projects.any(func project = project.id == target)) return #err("Project not found.");
      };
      case null {};
    };
    moveToProject(caller, id, projectId);
    #ok(())
  };

  public query func getBackendId() : async Principal { backendId };

  public shared query ({ caller }) func listCanisters() : async [Types.Entry] {
    authenticate(caller);
    account(caller).entries
  };

  public shared ({ caller }) func addCanister(id : Principal, name : Text) : async Types.Result<()> {
    authenticate(caller);
    add(caller, id, name, null)
  };

  public shared ({ caller }) func addCanisterInProject(id : Principal, name : Text, projectId : ?Nat) : async Types.Result<()> {
    authenticate(caller);
    add(caller, id, name, projectId)
  };

  func add(caller : Principal, id : Principal, name : Text, projectId : ?Nat) : Types.Result<()> {
    switch (projectId) {
      case (?target) {
        if (not projectAccount(caller).projects.any(func project = project.id == target)) return #err("Project not found.");
      };
      case null {};
    };
    if (id.isAnonymous() or id == Principal.fromText("aaaaa-aa")) {
      return #err("Enter an application canister ID, not an anonymous or management principal.");
    };
    if (name.size() == 0 or name.size() > 80) return #err("Name must contain 1 to 80 characters.");
    let current = account(caller);
    if (Watchlist.find(current.entries, id) != null) return #err("This canister is already in your watchlist.");
    if (current.entries.size() >= 20) return #err("Your watchlist is limited to 20 canisters.");
    if (accounts.get(caller) == null and accounts.size() >= 100) {
      return #err("This deployment has reached its 100-account capacity. Contact the operator.");
    };
    let entry : Types.Entry = {
      id; name; addedAt = Time.now(); lastAttempt = 0;
      snapshot = null; history = []; lastError = null;
    };
    accounts.add(caller, { current with entries = current.entries.concat([entry]) });
    if (projectId != null) moveToProject(caller, id, projectId);
    #ok(())
  };

  public shared ({ caller }) func removeCanister(id : Principal) : async Types.Result<()> {
    authenticate(caller);
    let current = account(caller);
    if (Watchlist.find(current.entries, id) == null) return #err("Canister not found.");
    accounts.add(caller, { current with entries = current.entries.filter(func item = item.id != id) });
    moveToProject(caller, id, null);
    #ok(())
  };

  public shared ({ caller }) func refreshCanister(id : Principal) : async Types.Result<Types.Snapshot> {
    authenticate(caller);
    let now = Time.now();
    let current = account(caller);
    let entry = Watchlist.find(current.entries, id) ?? return #err("Add this canister to your watchlist first.");
    if (now - entry.lastAttempt < 60_000_000_000) return #err("Wait 60 seconds between refreshes of this canister.");
    if (now - current.lastRequest < 1_000_000_000) return #err("Wait one second between requests.");
    if (now - windowStart >= 60_000_000_000) {
      windowStart := now;
      windowCalls := 0;
    };
    if (windowCalls >= 120 or activeCalls >= 4) return #err("Monitor is busy. Please try again in a minute.");
    windowCalls += 1;
    activeCalls += 1;
    accounts.add(caller, {
      entries = Watchlist.replace(current.entries, { entry with lastAttempt = now });
      lastRequest = now;
    });

    try {
      let details = await (with timeout = 20) management.canister_status({ canister_id = id });
      let latest = account(caller);
      let existing = Watchlist.find(latest.entries, id) ?? return #err("Canister was removed while refreshing.");
      // A late callback must not change an entry that was removed and re-added.
      if (existing.addedAt != entry.addedAt or existing.lastAttempt != now) return #err("Refresh was superseded.");
      if (not Watchlist.canRead(details.settings, caller)) {
        let message = "Access denied: your signed-in principal must be an allowed status viewer or controller, or status must be public.";
        accounts.add(caller, { latest with entries = Watchlist.replace(latest.entries, {
          existing with snapshot = null; history = []; lastError = ?message;
        }) });
        return #err(message);
      };
      let snapshot : Types.Snapshot = { at = Time.now(); details };
      accounts.add(caller, { latest with entries = Watchlist.replace(latest.entries, {
        existing with
        snapshot = ?snapshot;
        history = Watchlist.append(existing.history, { at = snapshot.at; cycles = details.cycles });
        lastError = null;
      }) });
      #ok(snapshot)
    } catch (error) {
      let message = "Status unavailable. Check that the canister exists and grant the Orbit backend status-viewer access (or make status public). " # error.message();
      let latest = account(caller);
      switch (Watchlist.find(latest.entries, id)) {
        case (?existing) {
          if (existing.addedAt == entry.addedAt and existing.lastAttempt == now) {
            accounts.add(caller, { latest with entries = Watchlist.replace(latest.entries, { existing with lastError = ?message }) });
          };
        };
        case null {};
      };
      #err(message)
    } finally {
      activeCalls -= 1;
    }
  };
};
