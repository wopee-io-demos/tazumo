export type StoreProfile = {
  name: string;
  slug: string;
  marketCode: string;
  address: { line1: string; line2?: string; city: string; postalCode: string; countryCode: string };
  contact: { email: string; phone: string };
  legalEntity: { registeredName: string; registrationNumber: string; vatId?: string };
};

export type FieldError = { path: string; code: 'required' | 'too_long' | 'invalid_format' };

const slugPattern = /^[a-z0-9-]{1,64}$/;
const countryPattern = /^[A-Z]{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{6,14}$/;
const postalPattern = /^[A-Za-z0-9 -]{2,12}$/;
const registrationPattern = /^[A-Za-z0-9 ./-]{1,32}$/;
const vatPattern = /^[A-Z]{2}[A-Za-z0-9]{2,13}$/;

export function validateStoreProfile(profile: StoreProfile): FieldError[] {
  const errors: FieldError[] = [];
  const text = (path: string, value: string | undefined, max: number, optional = false) => {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      if (!optional) errors.push({ path, code: 'required' });
      return false;
    }
    if (typeof value !== 'string') {
      errors.push({ path, code: 'invalid_format' });
      return false;
    }
    if (value.length > max) {
      errors.push({ path, code: 'too_long' });
      return false;
    }
    return true;
  };
  const pattern = (path: string, value: string | undefined, regex: RegExp, max: number, optional = false) => {
    if (text(path, value, max, optional) && !regex.test(value as string)) errors.push({ path, code: 'invalid_format' });
  };

  text('name', profile?.name, 200);
  pattern('slug', profile?.slug, slugPattern, 64);
  pattern('marketCode', profile?.marketCode, slugPattern, 64);
  text('address.line1', profile?.address?.line1, 200);
  text('address.line2', profile?.address?.line2, 200, true);
  text('address.city', profile?.address?.city, 120);
  pattern('address.postalCode', profile?.address?.postalCode, postalPattern, 12);
  pattern('address.countryCode', profile?.address?.countryCode, countryPattern, 2);
  pattern('contact.email', profile?.contact?.email, emailPattern, 254);
  pattern('contact.phone', profile?.contact?.phone, phonePattern, 16);
  text('legalEntity.registeredName', profile?.legalEntity?.registeredName, 200);
  pattern('legalEntity.registrationNumber', profile?.legalEntity?.registrationNumber, registrationPattern, 32);
  pattern('legalEntity.vatId', profile?.legalEntity?.vatId, vatPattern, 15, true);
  return errors;
}
