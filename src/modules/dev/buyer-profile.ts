type ExistingDevBuyerUser = {
  id: string;
  email: string;
};

export function selectDevBuyerUser(input: {
  byId: ExistingDevBuyerUser | null;
  byEmail: ExistingDevBuyerUser | null;
}) {
  if (input.byEmail) {
    return input.byEmail;
  }

  return input.byId;
}

export function shouldCreateDevBuyerUser(input: {
  byId: ExistingDevBuyerUser | null;
  byEmail: ExistingDevBuyerUser | null;
}) {
  return selectDevBuyerUser(input) === null;
}

export function buildDevBuyerUserUpdate(input: {
  companyId: string;
  branchId: string | null;
  firstName: string;
  lastName: string;
  email: string;
}) {
  return {
    companyId: input.companyId,
    branchId: input.branchId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: "+2348010001111",
    isActive: true,
  };
}

export function buildDevBuyerProfileData() {
  return {
    nationality: "Nigerian",
    addressLine1: "12 Admiralty Way",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    occupation: "Real estate buyer",
    nextOfKinName: "Chika Okafor",
    nextOfKinPhone: "+2348010002222",
    profileCompleted: true,
  };
}
