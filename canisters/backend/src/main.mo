import Types "types";
import Monitoring "mixins/monitoring";
import Principal "mo:core/Principal";

actor Orbit {
  let accounts : Types.State;
  let projectAccounts : Types.ProjectsState;
  include Monitoring(accounts, projectAccounts, Principal.fromActor(Orbit));
};
