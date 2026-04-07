#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Env, String, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub struct Mandate {
    pub max_budget_usdc: i128,
    pub allowed_domains: String,
}

#[contracttype]
pub enum DataKey {
    Mandate(String),
}

#[contract]
pub struct RiskMandates;

#[contractimpl]
impl RiskMandates {

    pub fn set_mandate(
        env: Env,
        user: String,
        max_budget_usdc: i128,
        allowed_domains: String,
    ) {
        let mandate = Mandate {
            max_budget_usdc,
            allowed_domains,
        };

        // Using instance storage inside the same mandate user as requested:
        env.storage().instance()
            .set(&DataKey::Mandate(user.clone()), &mandate);
            
        // Extend TTL
        env.storage().instance()
            .extend_ttl(10_000, 10_000);
    }

    pub fn get_mandate(env: Env, user: String) -> Option<Mandate> {
        env.storage().instance().get(&DataKey::Mandate(user))
    }
}
