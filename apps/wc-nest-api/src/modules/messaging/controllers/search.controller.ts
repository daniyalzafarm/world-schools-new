import { Controller, Get, Logger, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator'
import { SearchService } from '../services/search.service'
import { SearchMessagesDto } from '../dto/search.dto'
import { SearchResultsResponseDto } from '../dto/response.dto'

@ApiTags('Search')
@ApiBearerAuth()
@Controller('messaging/search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name)

  constructor(private readonly searchService: SearchService) {}

  /**
   * Search messages using full-text search
   */
  @Get('messages')
  @ApiOperation({
    summary: 'Search messages',
    description: 'Searches messages using PostgreSQL full-text search with ranking',
  })
  @ApiQuery({ name: 'query', required: true, type: String, description: 'Search query' })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    type: String,
    description: 'Filter by conversation',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: SearchResultsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchMessages(
    @Query() searchDto: SearchMessagesDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Searching messages for query: "${searchDto.query}"`)

    // Override user ID with current user
    searchDto.userId = currentUserId

    const messages = await this.searchService.searchMessages(searchDto)

    return {
      success: true,
      message: 'Search results retrieved successfully',
      data: messages,
      meta: {
        total: messages.length,
        query: searchDto.query,
      },
    }
  }

  /**
   * Search messages using advanced full-text search with ranking
   */
  @Get('messages/advanced')
  @ApiOperation({
    summary: 'Advanced message search',
    description: 'Searches messages using PostgreSQL full-text search with ts_rank scoring',
  })
  @ApiQuery({ name: 'query', required: true, type: String, description: 'Search query' })
  @ApiQuery({
    name: 'conversationId',
    required: false,
    type: String,
    description: 'Filter by conversation',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Advanced search results retrieved successfully',
    type: SearchResultsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchMessagesAdvanced(
    @Query() searchDto: SearchMessagesDto,
    @CurrentUser('id') currentUserId: string
  ) {
    this.logger.log(`Advanced search for query: "${searchDto.query}"`)

    // Override user ID with current user
    searchDto.userId = currentUserId

    const messages = await this.searchService.searchMessagesFullText(searchDto)

    return {
      success: true,
      message: 'Advanced search results retrieved successfully',
      data: messages,
      meta: {
        total: Array.isArray(messages) ? messages.length : 0,
        query: searchDto.query,
      },
    }
  }
}
