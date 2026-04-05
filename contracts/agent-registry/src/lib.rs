#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Env, String, Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct AgentEntry {
    pub name:        Symbol,
    pub url:         String,
    pub price:       i128,
    pub asset:       Symbol,
    pub protocol:    Symbol,
    pub description: String,
    pub owner:       String,
    pub registered:  u64,
}

#[contracttype]
pub enum DataKey {
    Agent(Symbol),
    AgentList,
}

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {

    pub fn register(
        env:         Env,
        name:        Symbol,
        url:         String,
        price:       i128,
        asset:       Symbol,
        protocol:    Symbol,
        description: String,
        owner:       String,
    ) {
        let entry = AgentEntry {
            name: name.clone(), url, price, asset,
            protocol, description, owner,
            registered: env.ledger().timestamp(),
        };

        // Persistent storage — survives ledger gaps
        env.storage().persistent()
            .set(&DataKey::Agent(name.clone()), &entry);
        env.storage().persistent()
            .extend_ttl(&DataKey::Agent(name.clone()), 100_000, 100_000);

        // Actualizar lista maestra
        let mut list: Vec<Symbol> = env.storage().instance()
            .get(&DataKey::AgentList)
            .unwrap_or_else(|| Vec::new(&env));
        if !list.contains(&name) {
            list.push_back(name);
        }
        env.storage().instance()
            .set(&DataKey::AgentList, &list);
        env.storage().instance()
            .extend_ttl(100_000, 100_000);
    }

    pub fn get_agent(env: Env, name: Symbol) -> Option<AgentEntry> {
        env.storage().persistent().get(&DataKey::Agent(name))
    }

    pub fn list_agents(env: Env) -> Vec<Symbol> {
        env.storage().instance()
            .get(&DataKey::AgentList)
            .unwrap_or_else(|| Vec::new(&env))
    }
}
