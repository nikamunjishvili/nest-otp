import {
  Controller,
  Post,
  Body,
  UsePipes,
  UseGuards,
  HttpCode,
  Req,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateUserDto } from './dto/create-user.dto';
import { signupSchema } from '../common/joi-schema/signup';
import { JoiValidationPipe } from '../common/pipes/joi';
import { verifyPhoneSchema } from 'src/common/joi-schema/verify-phone';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { tokenSchema } from 'src/common/joi-schema/token';
import { set2faSchema } from 'src/common/joi-schema/set2fa';

@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post('signup')
  @UsePipes(new JoiValidationPipe(signupSchema))
  create(@Body() createUserDto: CreateUserDto) {
    return this.accountService.signUp(createUserDto);
  }

  @HttpCode(200)
  @Post('phone/verify')
  @UsePipes(new JoiValidationPipe(verifyPhoneSchema))
  @UseGuards(AuthGuard)
  verifyPhone(@Body() _body, @Req() request: Request) {
    return this.accountService.verifyPhone(request);
  }

  @UsePipes(new JoiValidationPipe(tokenSchema))
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Post('phone/verify/token')
  validatePhoneVerification(
    @Body() _body,
    @Req() request: { body: { token?: string } },
  ) {
    return this.accountService.validatePhoneVerification(request);
  }

  @UsePipes(new JoiValidationPipe(set2faSchema))
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Post('set/twofa')
  enableTwoFA(@Body() _body, @Req() request: any) {
    return this.accountService.setTwoFA(request);
  }

  @UsePipes(new JoiValidationPipe(tokenSchema))
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Post('disable-twofa/verify')
  disable2FAVerification(
    @Body() _body,
    @Req() request: { body: { token?: string } },
  ) {
    return this.accountService.disable2FAVerification(request);
  }
}
