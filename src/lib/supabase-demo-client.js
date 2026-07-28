const ok = (data = null) => Promise.resolve({ data, error: null });

const createQuery = () => {
  const query = {
    select: () => query,
    insert: () => query,
    upsert: () => query,
    update: () => query,
    delete: () => query,
    eq: () => query,
    neq: () => query,
    gt: () => query,
    gte: () => query,
    lt: () => query,
    lte: () => query,
    in: () => query,
    is: () => query,
    match: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    single: () => ok(null),
    maybeSingle: () => ok(null),
    then: (resolve, reject) => ok([]).then(resolve, reject),
  };

  return query;
};

const createChannel = () => {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => ok(),
  };
  return channel;
};

export const createClient = () => ({
  auth: {
    getSession: () => ok({ session: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: () => ok(),
    signOut: () => ok(),
    signUp: () => ok(),
    resend: () => ok(),
    updateUser: () => ok(),
    refreshSession: () => ok(),
    exchangeCodeForSession: () => ok(),
    mfa: {
      listFactors: () => ok({ all: [], totp: [] }),
      enroll: () => ok(),
      unenroll: () => ok(),
      challengeAndVerify: () => ok(),
    },
  },
  from: () => createQuery(),
  rpc: () => ok([]),
  channel: () => createChannel(),
  removeChannel: () => ok(),
  storage: {
    from: () => ({
      upload: () => ok(),
      remove: () => ok(),
      createSignedUrl: () => ok({ signedUrl: '' }),
    }),
  },
});
