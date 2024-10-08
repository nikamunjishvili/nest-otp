import * as bcrypt from 'bcrypt';

export const hashPassword = async (password: string): Promise<string> => {
  const hash = await bcrypt.hash(password, 10);
  return hash;
};

export const verifyPassword = async (password, hash): Promise<boolean> => {
  const isMatch = await bcrypt.compare(password, hash);
  return isMatch;
};