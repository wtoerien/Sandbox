import { db } from "./db";
import { hashPassword } from "./auth";

export async function seedIfEmpty() {
  const practiceCount = await db.practice.count();
  if (practiceCount > 0) return;

  const practice = await db.practice.create({
    data: {
      name: "Demo Accounting Practice",
      email: "admin@demopractice.com",
      phone: "02 9000 0000",
      address: "1 Main Street, Sydney NSW 2000",
    },
  });

  await db.user.create({
    data: {
      email: "admin@demopractice.com",
      password: await hashPassword("password"),
      firstName: "Admin",
      lastName: "User",
      role: "ADMIN",
      practiceId: practice.id,
    },
  });

  // Seed some job templates
  await db.jobTemplate.create({
    data: {
      name: "Individual Tax Return",
      description: "Annual individual income tax return",
      category: "TAX_RETURN",
      steps: {
        create: [
          { order: 1, name: "Gather documents", description: "Collect PAYG summaries, bank statements, and receipts" },
          { order: 2, name: "Data entry", description: "Enter all income and deduction data" },
          { order: 3, name: "Review and check", description: "Review the return for accuracy" },
          { order: 4, name: "Client approval", description: "Send to client for approval and signature" },
          { order: 5, name: "Lodge with ATO", description: "Submit the return electronically" },
        ],
      },
    },
  });

  await db.jobTemplate.create({
    data: {
      name: "Business Activity Statement",
      description: "Quarterly BAS lodgement",
      category: "BAS",
      steps: {
        create: [
          { order: 1, name: "Reconcile accounts", description: "Reconcile GST accounts for the period" },
          { order: 2, name: "Prepare BAS", description: "Complete the activity statement" },
          { order: 3, name: "Review", description: "Review figures and calculations" },
          { order: 4, name: "Client approval", description: "Get client sign-off" },
          { order: 5, name: "Lodge with ATO", description: "Submit electronically" },
        ],
      },
    },
  });

  await db.jobTemplate.create({
    data: {
      name: "Company Tax Return",
      description: "Annual company income tax return",
      category: "TAX_RETURN",
      steps: {
        create: [
          { order: 1, name: "Obtain financial statements", description: "Get signed accounts from client" },
          { order: 2, name: "Tax adjustments", description: "Process tax adjustments and reconciliations" },
          { order: 3, name: "Prepare return", description: "Complete the company tax return" },
          { order: 4, name: "Review by manager", description: "Manager review and sign-off" },
          { order: 5, name: "Client approval", description: "Client reviews and approves" },
          { order: 6, name: "Lodge with ATO", description: "Lodge electronically" },
        ],
      },
    },
  });

  await db.jobTemplate.create({
    data: {
      name: "Monthly Bookkeeping",
      description: "Ongoing monthly bookkeeping services",
      category: "BOOKKEEPING",
      steps: {
        create: [
          { order: 1, name: "Process transactions", description: "Code and process all bank transactions" },
          { order: 2, name: "Reconcile bank accounts", description: "Reconcile all bank and credit card accounts" },
          { order: 3, name: "Review accounts", description: "Review P&L and balance sheet" },
          { order: 4, name: "Send reports to client", description: "Email monthly reports" },
        ],
      },
    },
  });

  // Seed a sample client
  await db.client.create({
    data: {
      code: "IND001",
      name: "John Smith",
      email: "john.smith@example.com",
      phone: "0400 000 000",
      clientType: "INDIVIDUAL",
      taxFileNumber: "123 456 789",
    },
  });
}
