import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Types "../types";

module {
  public func canRead(settings : Types.Settings, caller : Principal) : Bool {
    if (settings.controllers.any(func controller = controller == caller)) return true;
    switch (settings.status_visibility) {
      case (?#public_) true;
      case (?#allowed_viewers(viewers)) viewers.any(func viewer = viewer == caller);
      case _ false;
    }
  };

  public func find(entries : [Types.Entry], id : Principal) : ?Types.Entry {
    entries.find(func entry = entry.id == id)
  };

  public func replace(entries : [Types.Entry], entry : Types.Entry) : [Types.Entry] {
    entries.map(func current = if (current.id == entry.id) entry else current)
  };

  public func append(history : [Types.Point], point : Types.Point) : [Types.Point] {
    let bounded = if (history.size() >= 60) history.sliceToArray(1, 60) else history;
    bounded.concat([point])
  };
}
