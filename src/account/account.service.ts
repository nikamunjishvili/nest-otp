import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { hashPassword } from 'src/common/utils/passwordHasher';
import _ from 'underscore';
import { generateOTP } from 'src/common/utils/codeGenerator';
import { getExpiry, isTokenExpired } from 'src/common/utils/dateTimeUtility';
import { Prisma } from '@prisma/client';
import { sendSMS } from 'src/common/utils/twilio';

@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  async signUp(createUserDto: CreateUserDto) {
    createUserDto.password = await hashPassword(createUserDto.password);
    const user = await this.prisma.user.create({ data: createUserDto });
    return _.omit(user, 'password');
  }

  async verifyPhone(req: Request) {
    const userDetails = req['user'];
    const user = await this.prisma.user.findUnique({
        where: { id: userDetails.sub },
    });
    
    if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    
    if (user.isPhoneVerified) {
        return { success: true }; // Phone is already verified
    }

    const otp = generateOTP(6); // Generate a 6-digit OTP
    const otpPayload: Prisma.OtpUncheckedCreateInput = {
        userId: user.id,
        code: otp,
        useCase: 'PHV', // Use case for phone verification
        expiresAt: getExpiry(), // Set expiration time for the OTP
    };

    await this.prisma.otp.create({
        data: otpPayload, // Store OTP in the database
    });

    await sendSMS(
        user.phone,
        `Use this code ${otp} to verify the phone number registered on your account`,
    ); // Send OTP to the user's phone

    return { success: true }; // Indicate success
}


  async validatePhoneVerification(req: { body: { token?: string } }) {
    const {
      body: { token },
    } = req;
    const userDetails = req['user'];
    const otpRecord = await this.prisma.otp.findFirst({
      where: { code: token, useCase: 'PHV', userId: userDetails.sub },
    });
    if (!otpRecord) {
      throw new HttpException('Invalid OTP', HttpStatus.NOT_FOUND);
    }
    const isExpired = isTokenExpired(otpRecord.expiresAt);
    if (isExpired) {
      throw new HttpException('Expired token', HttpStatus.NOT_FOUND);
    }
    await this.prisma.user.update({
      where: { id: userDetails.sub },
      data: { isPhoneVerified: true },
    });

    await this.prisma.otp.delete({ where: { id: otpRecord.id } });
    return { success: true };
  }

  async setTwoFA(req: { body: { set_2fa?: any } }) {
    const {
      body: { set_2fa },
    } = req;
    const userDetails = req['user'];

    const user = await this.prisma.user.findUnique({
      where: { id: userDetails.sub },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.twoFA === set_2fa) {
      return { success: true };
    }

    if (user.twoFA && set_2fa == false) {
      const otp = generateOTP(6);
      const otpPayload: Prisma.OtpUncheckedCreateInput = {
        userId: user.id,
        code: otp,
        useCase: 'D2FA',
        expiresAt: getExpiry(),
      };

      await this.prisma.otp.create({
        data: otpPayload,
      });
      await sendSMS(
        user.phone,
        `Use this code ${otp} to disable multifactor authentication on your account`,
      );
      return { success: true };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFA: set_2fa },
    });

    return { success: true };
  }

  async disable2FAVerification(req: { body: { token?: string } }) {
    const {
      body: { token },
    } = req;
    const userDetails = req['user'];
    const otpRecord = await this.prisma.otp.findFirst({
      where: { code: token, useCase: 'D2FA', userId: userDetails.sub },
    });
    if (!otpRecord) {
      throw new HttpException('Invalid OTP', HttpStatus.NOT_FOUND);
    }
    const isExpired = isTokenExpired(otpRecord.expiresAt);
    if (isExpired) {
      throw new HttpException('Expired token', HttpStatus.NOT_FOUND);
    }
    await this.prisma.user.update({
      where: { id: userDetails.sub },
      data: { twoFA: false },
    });

    await this.prisma.otp.delete({ where: { id: otpRecord.id } });
    return { success: true };
  }
}
