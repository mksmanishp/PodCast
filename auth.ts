import { createAuth } from "@keystone-6/auth";
import { statelessSessions } from "@keystone-6/core/session";

const { withAuth } = createAuth({
  listKey: "User",
  identityField: "email",
  sessionData: "name createdAt isAdmin",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password", "isAdmin"]
  }

})

const seesionMaxAge = 60 * 60 * 24 * 30

const session = statelessSessions({
  maxAge: seesionMaxAge,
  secret: process.env.SESSION_SECRET,
})

export { withAuth, session }