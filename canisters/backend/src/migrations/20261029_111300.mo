import Map "mo:core/Map";

module {
  type Project = { id : Nat; name : Text; canisterIds : [Principal] };
  type OldActor = {};
  type NewActor = {
    projectAccounts : Map.Map<Principal, { projects : [Project]; nextId : Nat }>;
  };
  public func migration(_old : OldActor) : NewActor {
    { projectAccounts = Map.empty() }
  };
};
