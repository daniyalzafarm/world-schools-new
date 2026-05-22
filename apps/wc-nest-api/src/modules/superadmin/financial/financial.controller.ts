import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { ResponseUtil } from '../../../common/utils/response.util'
import { Permissions } from '../../core/auth/decorators/permissions.decorator'
import { RolesOrPermissionsGuard } from '../../core/auth/guards/roles-or-permissions.guard'
import { FinancialRangeDto } from './dto/financial-range.dto'
import { FinancialService } from './financial.service'

class UpcomingPayoutsQueryDto extends FinancialRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  daysAhead?: number
}

class ConnectedAccountsQueryDto extends FinancialRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

class BalanceTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

@ApiTags('SuperAdmin Financial')
@ApiBearerAuth()
@Controller('superadmin/financial')
@UseGuards(RolesOrPermissionsGuard)
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get('currencies')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'List currencies present in Payments (for dashboard selector)' })
  async getCurrencies() {
    return ResponseUtil.success(await this.financial.getCurrencies())
  }

  @Get('overview')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Financial KPI overview' })
  async getOverview(@Query() query: FinancialRangeDto) {
    return ResponseUtil.success(await this.financial.getOverview(query))
  }

  @Get('balance')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Live Stripe platform balance (available + pending per currency)' })
  async getBalance() {
    return ResponseUtil.success(await this.financial.getBalance())
  }

  @Get('balance-transactions')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Live Stripe BalanceTransactions ledger entries' })
  async getBalanceTransactions(@Query() query: BalanceTransactionsQueryDto) {
    return ResponseUtil.success(await this.financial.getBalanceTransactions(query.limit))
  }

  @Get('revenue-composition')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Bucketed application fees / refunds / reimbursements' })
  async getRevenueComposition(@Query() query: FinancialRangeDto) {
    return ResponseUtil.success(await this.financial.getRevenueComposition(query))
  }

  @Get('payment-status')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Payment status distribution (donut)' })
  async getPaymentStatus(@Query() query: FinancialRangeDto) {
    return ResponseUtil.success(await this.financial.getPaymentStatus(query))
  }

  @Get('upcoming-payouts')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Pending payout tranches scheduled in the next N days' })
  async getUpcomingPayouts(@Query() query: UpcomingPayoutsQueryDto) {
    return ResponseUtil.success(await this.financial.getUpcomingPayouts(query))
  }

  @Get('disputes-summary')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Dispute counts by outcome, dispute rate, urgent list' })
  async getDisputesSummary(@Query() query: FinancialRangeDto) {
    return ResponseUtil.success(await this.financial.getDisputesSummary(query))
  }

  @Get('refunds-summary')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Refunds by reason in window' })
  async getRefundsSummary(@Query() query: FinancialRangeDto) {
    return ResponseUtil.success(await this.financial.getRefundsSummary(query))
  }

  @Get('reimbursements-aging')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Outstanding reimbursements aged by overdue bucket' })
  async getReimbursementsAging(@Query() query: FinancialRangeDto) {
    return ResponseUtil.success(await this.financial.getReimbursementsAging(query))
  }

  @Get('connected-accounts')
  @Permissions('financial.read')
  @ApiOperation({ summary: 'Top providers by GMV with Stripe Connect health status' })
  async getConnectedAccounts(@Query() query: ConnectedAccountsQueryDto) {
    return ResponseUtil.success(await this.financial.getConnectedAccountsHealth(query))
  }
}
